// ═══════════════════════════════════════════════════════════════
//  GA WORKER POOL - Reference Implementation
// ═══════════════════════════════════════════════════════════════

class WorkerPool {
  constructor(totalTasks, workerScriptURL = null) {
    this.totalTasks = totalTasks;
    
    // Auto-detect optimal worker count
    const cores = navigator.hardwareConcurrency || 4;
    this.numWorkers = Math.min(
      cores >= 4 ? cores - 1 : cores,  // Leave 1 core for main thread
      8,                                // Cap at 8 workers
      totalTasks                        // Don't spawn more workers than tasks
    );
    
    // Fallback: Don't parallelize tiny workloads
    if (totalTasks <= 2) {
      this.numWorkers = 0;
    }
    
    this.workers = [];
    this.taskQueue = [];
    this.activeTasksPerWorker = new Map();
    this.results = [];
    this.progressCallbacks = [];
    this.workerScriptURL = workerScriptURL;
    
    // Progress tracking
    this.workerProgress = new Map(); // workerId -> {generation, maxGen}
    this.lastProgressUpdate = 0;
    this.PROGRESS_THROTTLE_MS = 100;
  }
  
  async init(sharedData) {
    if (this.numWorkers === 0) {
      return; // Sequential fallback
    }
    
    // Create worker script as Blob (for single-file deployment)
    const workerCode = this.workerScriptURL ? null : this.getInlineWorkerCode();
    const workerURL = this.workerScriptURL || URL.createObjectURL(
      new Blob([workerCode], {type: 'application/javascript'})
    );
    
    for (let i = 0; i < this.numWorkers; i++) {
      try {
        const worker = new Worker(workerURL);
        
        worker.onmessage = (e) => this.handleMessage(e, i);
        worker.onerror = (e) => this.handleError(e, i);
        
        // Send shared data to worker (one-time initialization)
        worker.postMessage({
          type: 'INIT',
          sharedData: sharedData
        });
        
        this.workers.push(worker);
        this.activeTasksPerWorker.set(i, null);
        this.workerProgress.set(i, {generation: 0, maxGen: 1});
      } catch (error) {
        console.error(`Failed to create worker ${i}:`, error);
        throw new Error('Worker initialization failed');
      }
    }
    
    // Small delay to ensure workers are ready
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  submitTask(taskData) {
    this.taskQueue.push(taskData);
  }
  
  run() {
    return new Promise((resolve, reject) => {
      this.onComplete = resolve;
      this.onError = reject;
      
      if (this.numWorkers === 0) {
        reject(new Error('WorkerPool not initialized (sequential fallback)'));
        return;
      }
      
      this.assignTasks();
    });
  }
  
  assignTasks() {
    for (let i = 0; i < this.workers.length; i++) {
      if (this.activeTasksPerWorker.get(i) === null && this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        this.activeTasksPerWorker.set(i, task.taskId);
        this.workers[i].postMessage(task);
      }
    }
  }
  
  handleMessage(event, workerId) {
    const msg = event.data;
    
    if (msg.type === 'ENSEMBLE_COMPLETE') {
      this.results.push(msg.result);
      this.activeTasksPerWorker.set(workerId, null);
      
      // Check if all tasks complete
      if (this.results.length === this.totalTasks) {
        this.cleanup();
        this.onComplete(this.results);
      } else {
        this.assignTasks(); // Assign next task to this worker
      }
    }
    
    if (msg.type === 'PROGRESS') {
      this.handleProgress(msg, workerId);
    }
    
    if (msg.type === 'ERROR') {
      this.handleError(msg.error, workerId);
    }
  }
  
  handleProgress(msg, workerId) {
    // Update progress for this worker
    this.workerProgress.set(workerId, {
      generation: msg.generation,
      maxGen: msg.maxGen,
      bestFitness: msg.bestFitness
    });
    
    // Throttle UI updates
    const now = Date.now();
    if (now - this.lastProgressUpdate < this.PROGRESS_THROTTLE_MS) return;
    this.lastProgressUpdate = now;
    
    // Aggregate progress across all workers
    const completedRuns = this.results.length;
    let activeProgress = 0;
    let activeBest = -Infinity;
    
    this.workerProgress.forEach((progress, wId) => {
      if (this.activeTasksPerWorker.get(wId) !== null) {
        activeProgress += progress.generation / progress.maxGen;
        activeBest = Math.max(activeBest, progress.bestFitness || -Infinity);
      }
    });
    
    const activeCount = Array.from(this.activeTasksPerWorker.values())
      .filter(v => v !== null).length;
    
    if (activeCount > 0) {
      activeProgress /= activeCount;
    }
    
    const totalProgress = (completedRuns + activeProgress) / this.totalTasks;
    
    // Find best fitness across completed + active
    const completedBest = this.results.length > 0
      ? Math.max(...this.results.map(r => r.bestFitness))
      : -Infinity;
    const currentBest = Math.max(completedBest, activeBest);
    
    // Notify callbacks
    this.progressCallbacks.forEach(cb => cb({
      totalProgress: totalProgress,
      completedRuns: completedRuns,
      totalRuns: this.totalTasks,
      currentBest: currentBest,
      activeWorkers: activeCount
    }));
  }
  
  handleError(error, workerId) {
    console.error(`Worker ${workerId} error:`, error);
    this.cleanup();
    this.onError(error);
  }
  
  onProgress(callback) {
    this.progressCallbacks.push(callback);
  }
  
  cleanup() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.activeTasksPerWorker.clear();
    this.workerProgress.clear();
  }
  
  isParallelEnabled() {
    return this.numWorkers > 0;
  }
  
  // Inline worker code (avoid separate file)
  getInlineWorkerCode() {
    return `
      // ═══════════════════════════════════════════════════════════════
      //  GA WORKER - Ensemble Run Executor
      // ═══════════════════════════════════════════════════════════════
      
      let sharedData = null;
      
      self.onmessage = function(e) {
        const msg = e.data;
        
        if (msg.type === 'INIT') {
          sharedData = msg.sharedData;
          return;
        }
        
        if (msg.type === 'RUN_ENSEMBLE') {
          try {
            const result = runEnsembleRun(msg);
            self.postMessage({
              type: 'ENSEMBLE_COMPLETE',
              taskId: msg.taskId,
              result: result
            });
          } catch (error) {
            self.postMessage({
              type: 'ERROR',
              taskId: msg.taskId,
              error: error.message
            });
          }
        }
      };
      
      function runEnsembleRun(msg) {
        const {W_norm, M, inconsistency, SKILL_COLS} = sharedData;
        const {weights, params, taskId} = msg;
        const {n, teamSize, popSize, maxGen, crossRate, mutRate, eliteRate} = params;
        
        // Noise injection on M
        const Mnoise = M.map(row => row.map(v => {
          const noise = v + (Math.random() - 0.5) * 0.2;
          return Math.min(1, Math.max(0, noise));
        }));
        
        // Initialize population
        let pop = [];
        pop.push(greedySeed(n, teamSize, W_norm));
        for (let i = 1; i < popSize; i++) {
          pop.push(shuffle(Array.from({length: n}, (_, k) => k)));
        }
        
        let bestFit = -Infinity, noImprove = 0, best = null;
        
        // Generational loop
        for (let gen = 0; gen < maxGen; gen++) {
          // Evaluate
          const scored = pop.map(p => {
            const part = makePartition(p, teamSize);
            const f = fitness(part, W_norm, Mnoise, inconsistency, weights, SKILL_COLS.length);
            return {p, f};
          });
          scored.sort((a, b) => b.f.total - a.f.total);
          
          if (scored[0].f.total > bestFit) {
            bestFit = scored[0].f.total;
            best = scored[0];
            noImprove = 0;
          } else {
            noImprove++;
          }
          
          if (noImprove >= 100) break;
          
          // Elitism
          const elite = Math.max(1, Math.floor(popSize * eliteRate));
          const newPop = scored.slice(0, elite).map(s => s.p);
          
          // Crossover + mutate
          while (newPop.length < popSize) {
            const p1 = scored[Math.floor(Math.random() * Math.floor(popSize * 0.3))].p;
            const p2 = scored[Math.floor(Math.random() * Math.floor(popSize * 0.3))].p;
            let child = Math.random() < crossRate ? pmxCross(p1, p2) : p1.slice();
            if (Math.random() < mutRate) child = mutate(child);
            newPop.push(child);
          }
          pop = newPop;
          
          // Progress update (every 50 generations)
          if (gen % 50 === 0) {
            self.postMessage({
              type: 'PROGRESS',
              taskId: taskId,
              generation: gen,
              maxGen: maxGen,
              bestFitness: bestFit
            });
          }
        }
        
        return {
          bestPerm: best.p,
          bestFitness: best.f.total,
          fitnessComponents: {
            fSkill: best.f.fSkill,
            fPers: best.f.fPers,
            fBal: best.f.fBal
          },
          metadata: {
            generations: gen,
            converged: noImprove >= 100
          }
        };
      }
      
      // ═══════════════════════════════════════════════════════════════
      //  GA CORE FUNCTIONS (copied from main thread)
      // ═══════════════════════════════════════════════════════════════
      
      function fitness(partition, W_norm, M, inconsistency, weights, numSkills) {
        const {wSkill, wMbti, wBal} = weights;
        let totalFSkill = 0, totalFPers = 0;
        const teamStrengths = [];
        
        partition.forEach(team => {
          if (!team.length) return;
          
          // F_skill
          let fSkill = 0;
          for (let j = 0; j < numSkills; j++) {
            const coverage = Math.min(1, team.reduce((s, i) => s + Math.max(0, W_norm[i][j]), 0));
            const maxW = Math.max(...team.map(i => Math.max(0, W_norm[i][j])));
            const sumW = team.reduce((s, i) => s + Math.max(0, W_norm[i][j]), 0) + 1e-5;
            const diversity = 1 - (maxW / sumW);
            fSkill += coverage + 0.5 * diversity;
          }
          fSkill /= numSkills;
          totalFSkill += fSkill;
          
          // F_personality
          let fPers = 0, pairs = 0;
          for (let a = 0; a < team.length; a++) {
            for (let b = a + 1; b < team.length; b++) {
              const ia = team[a], ib = team[b];
              const compat = M[ia].reduce((s, v, d) => s + Math.abs(v - M[ib][d]), 0) / 4;
              const wi = 1 - (inconsistency[ia] * 0.7);
              const wj = 1 - (inconsistency[ib] * 0.7);
              fPers += compat * wi * wj;
              pairs++;
            }
          }
          fPers = pairs > 0 ? fPers / pairs : 0;
          totalFPers += fPers;
          
          // Team strength for balance
          const str = team.reduce((s, i) => s + W_norm[i].reduce((a, b) => a + Math.max(0, b), 0), 0);
          teamStrengths.push(str);
        });
        
        const n = partition.filter(t => t.length).length;
        totalFSkill /= n;
        totalFPers /= n;
        const meanStr = teamStrengths.reduce((a, b) => a + b, 0) / teamStrengths.length || 1;
        const stdStr = Math.sqrt(teamStrengths.reduce((a, b) => a + (b - meanStr) ** 2, 0) / teamStrengths.length) || 1e-5;
        const fBal = 1 - (stdStr / (meanStr + 1e-5));
        
        return {
          total: wSkill * totalFSkill + wMbti * totalFPers + wBal * fBal,
          fSkill: totalFSkill,
          fPers: totalFPers,
          fBal
        };
      }
      
      function makePartition(perm, teamSize) {
        const n = perm.length;
        const nTeams = Math.ceil(n / teamSize);
        const part = [];
        for (let t = 0; t < nTeams; t++) {
          part.push(perm.slice(t * teamSize, Math.min((t + 1) * teamSize, n)));
        }
        return part;
      }
      
      function greedySeed(n, teamSize, W_norm) {
        const scores = Array.from({length: n}, (_, i) => ({
          i,
          s: W_norm[i].reduce((a, b) => a + Math.max(0, b), 0)
        }));
        scores.sort((a, b) => b.s - a.s);
        const perm = new Array(n);
        const nTeams = Math.ceil(n / teamSize);
        scores.forEach(({i}, pos) => {
          const team = pos % nTeams;
          perm[team * Math.ceil(n / nTeams) + Math.floor(pos / nTeams)] = i;
        });
        // Fill gaps
        const seen = new Set(perm.filter(v => v !== undefined));
        let fill = 0;
        for (let k = 0; k < n; k++) {
          if (perm[k] === undefined) {
            while (seen.has(fill)) fill++;
            perm[k] = fill;
            seen.add(fill);
          }
        }
        return perm;
      }
      
      function pmxCross(p1, p2) {
        const n = p1.length;
        const a = Math.floor(Math.random() * n);
        const b = Math.floor(Math.random() * n);
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const child = new Array(n).fill(-1);
        for (let i = lo; i <= hi; i++) child[i] = p1[i];
        const remaining = p2.filter(v => !child.includes(v));
        let ri = 0;
        for (let i = 0; i < n; i++) {
          if (child[i] === -1) child[i] = remaining[ri++];
        }
        return child;
      }
      
      function mutate(perm) {
        const c = perm.slice();
        const a = Math.floor(Math.random() * c.length);
        const b = Math.floor(Math.random() * c.length);
        [c[a], c[b]] = [c[b], c[a]];
        return c;
      }
      
      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }
    `;
  }
}

// ═══════════════════════════════════════════════════════════════
//  USAGE EXAMPLE
// ═══════════════════════════════════════════════════════════════

async function runGAWithWorkers(data, params) {
  const {teamSize, popSize, maxGen, crossRate, mutRate, eliteRate, ensembleN, weights} = params;
  
  // Preprocessing (sequential, on main thread)
  const {W_norm, M, inconsistency} = preprocess(data);
  const n = data.length;
  
  // Try parallel execution
  const pool = new WorkerPool(ensembleN);
  
  try {
    await pool.init({
      W_norm: W_norm,
      M: M,
      inconsistency: inconsistency,
      SKILL_COLS: SKILL_COLS
    });
    
    if (!pool.isParallelEnabled()) {
      throw new Error('Parallel execution not available');
    }
    
    // Queue ensemble runs
    for (let run = 0; run < ensembleN; run++) {
      pool.submitTask({
        type: 'RUN_ENSEMBLE',
        taskId: run,
        weights: weights,
        params: {n, teamSize, popSize, maxGen, crossRate, mutRate, eliteRate}
      });
    }
    
    // Setup progress callback
    pool.onProgress((progress) => {
      const pct = Math.round(5 + progress.totalProgress * 90);
      setP(pct, \`Ensemble \${progress.completedRuns}/\${progress.totalRuns} · \${progress.activeWorkers} workers · Best \${progress.currentBest.toFixed(3)}\`);
    });
    
    // Run parallel execution
    log('[INFO] Running ensemble with ' + pool.numWorkers + ' workers', 'info');
    const results = await pool.run();
    
    // Find best result
    let bestOverall = results[0];
    for (const result of results) {
      if (result.bestFitness > bestOverall.bestFitness) {
        bestOverall = result;
      }
    }
    
    return bestOverall;
    
  } catch (error) {
    console.warn('Worker execution failed, falling back to sequential:', error);
    log('[WARN] Parallelization failed, using sequential mode', 'warn');
    pool.cleanup();
    
    // Fallback to sequential
    return await runGASequential(data, params);
  }
}

async function runGASequential(data, params) {
  // Original implementation (lines 1313-1371)
  // ... existing code ...
}
