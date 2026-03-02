# Fix Custom Teams (Locked & Semi) Treated as Random by GA

## Problem
Custom tim yang di-lock dan semi-lock masih dianggap random oleh genetic algorithm. 3 bug kritis ditemukan.

---

## Bug 1: MBTI Matrix Wrongly Constructed in Subset Mode
**File**: `team_optimizer.html` lines 2298-2304

**Current (BROKEN)**:
```javascript
const Mnoise_full = M.map(row=>row.map(v=>{
  const noise=v+(Math.random()-0.5)*0.2;
  return Math.min(1,Math.max(0,noise));
}));
currentMnoise = studentsToOptimize.map(fullIdx => 
  studentsToOptimize.map(fullIdx2 => Mnoise_full[fullIdx][fullIdx2])
);
```

**Problem**: `M` is `[n_students][4]` (4 MBTI dims), NOT NxN. `Mnoise_full[fullIdx][fullIdx2]` returns `undefined` for `fullIdx2 >= 4`, corrupting all MBTI fitness calculations.

**Fix** - Replace the `currentMnoise = ...` line with:
```javascript
const Mnoise_full = M.map(row=>row.map(v=>{
  const noise=v+(Math.random()-0.5)*0.2;
  return Math.min(1,Math.max(0,noise));
}));
// M is [n_students][4] (4 MBTI dimensions), NOT a square matrix
// Simple row selection to remap to subset indices
currentMnoise = studentsToOptimize.map(fullIdx => Mnoise_full[fullIdx]);
```

---

## Bug 2: `inconsistency` Array Not Remapped in Subset Mode
**File**: `team_optimizer.html` line 2345

**Current (BROKEN)**:
```javascript
const f = fitnessAuto(part, currentW_norm, currentMnoise, inconsistency, weights);
```

**Problem**: `inconsistency` uses full data indices but partition has subset indices. `inconsistency[ia]` reads wrong student data.

**Fix** - Add `currentInconsistency` creation inside the `if(isSubsetMode)` block (after line 2296), and use it in the fitness call.

In the `if(isSubsetMode)` block (after `currentW_norm` assignment at line 2296), add:
```javascript
currentInconsistency = studentsToOptimize.map(fullIdx => inconsistency[fullIdx]);
```

In the `else` block (line 2306), add:
```javascript
currentInconsistency = inconsistency;
```

Declare `currentInconsistency` alongside `currentW_norm` and `currentMnoise` at line 2292:
```javascript
let currentW_norm, currentMnoise, currentInconsistency;
```

Then change ALL `fitnessAuto(..., inconsistency, ...)` calls inside the GA loop to use `currentInconsistency` instead:
- Line 2345: `fitnessAuto(part, currentW_norm, currentMnoise, currentInconsistency, weights)`

---

## Bug 3: Multiple Partial Groups Not Aligned to Team Boundaries
**File**: `team_optimizer.html` lines 2181-2226

**Current (BROKEN)**:
Partial group members are packed consecutively:
- Group A (2 members): positions [0, 1]
- Group B (1 member): position [2]
With teamSize=4, makePartition puts them all in Team 0 = [0,1,2,3]

**Fix** - Replace the entire pre-assignment strategy block (lines 2181-2226) with team-boundary-aware pinning:

```javascript
if(groupAnalysis.hasPreAssigned) {
  // 1) Mark locked students
  groupAnalysis.lockedGroups.forEach(g => g.members.forEach(idx => lockedSet.add(idx)));
  
  // 2) Collect partial members and free students
  const allPartialMembers = new Set();
  groupAnalysis.partialGroups.forEach(g => g.members.forEach(idx => allPartialMembers.add(idx)));
  
  const freeStudents = [];
  for(let i = 0; i < n; i++) {
    if(!lockedSet.has(i) && !allPartialMembers.has(i)) {
      freeStudents.push(i);
    }
  }
  
  const nToOptimize = allPartialMembers.size + freeStudents.length;
  
  // 3) Calculate team layout (same logic as makePartition)
  const optRemainder = nToOptimize % teamSize;
  const nTeamsLarge = optRemainder; // teams of size teamSize+1
  const nTeamsNormal = (nToOptimize - nTeamsLarge * (teamSize + 1)) / teamSize;
  const totalOptTeams = nTeamsLarge + nTeamsNormal;
  
  // Calculate team boundaries (start position of each team in the permutation)
  const teamBounds = []; // [{start, size}]
  let pos = 0;
  for(let t = 0; t < totalOptTeams; t++) {
    const sz = t < nTeamsLarge ? teamSize + 1 : teamSize;
    teamBounds.push({start: pos, size: sz});
    pos += sz;
  }
  
  // 4) Assign each partial group to a separate team slot
  //    Place partial members at the START of that team's position range
  //    This ensures makePartition groups them into the same team
  studentsToOptimize.length = nToOptimize; // pre-allocate
  const usedPositions = new Set();
  
  groupAnalysis.partialGroups.forEach((g, gi) => {
    if(gi >= totalOptTeams) {
      // Edge case: more partial groups than teams (shouldn't happen normally)
      log(`[WARN] Partial group ${g.id} cannot be assigned to a separate team`, 'warn');
      return;
    }
    const teamStart = teamBounds[gi].start;
    g.members.forEach((fullIdx, k) => {
      studentsToOptimize[teamStart + k] = fullIdx;
      usedPositions.add(teamStart + k);
      pinnedBlocks.push([]); // will be rebuilt below
    });
  });
  
  // Rebuild pinnedBlocks properly (one array per partial group)
  pinnedBlocks.length = 0;
  groupAnalysis.partialGroups.forEach((g, gi) => {
    if(gi >= totalOptTeams) return;
    const teamStart = teamBounds[gi].start;
    const block = g.members.map((_, k) => teamStart + k);
    pinnedBlocks.push(block);
  });
  
  // 5) Fill remaining positions with free students
  let freeIdx = 0;
  for(let i = 0; i < nToOptimize; i++) {
    if(!usedPositions.has(i)) {
      studentsToOptimize[i] = freeStudents[freeIdx++];
    }
  }
  
  const pinnedSize = allPartialMembers.size;
  
  log(`[STRATEGY] ${lockedSet.size} locked (excluded), ${pinnedSize} pinned (partial groups), ${freeStudents.length} free`, 'info');
  log(`[STRATEGY] GA will optimize ${nToOptimize} students in ${totalOptTeams} teams`, 'info');
  if(pinnedBlocks.length > 0) {
    pinnedBlocks.forEach((block, bi) => {
      const names = block.map(si => data[studentsToOptimize[si]].Nama).join(', ');
      const teamIdx = bi;
      log(`  • Pinned block ${bi+1} (Team ${teamIdx+1}): [${names}]`, 'info');
    });
  }
  
  // Edge case: all students locked, nothing to optimize
  if(nToOptimize === 0) {
    log('[INFO] All students in locked groups, no optimization needed', 'ok');
    finalPartitionResult = groupAnalysis.lockedGroups.map(g => [...g.members]);
    bestOverall = {
      p: finalPartitionResult.flat(),
      f: {total: 1, fSkill: 1, fPers: 1, fBal: 1}
    };
  }
}
```

---

## Summary of All Changes

| Location | Change |
|----------|--------|
| Line 2292 | Add `currentInconsistency` to `let` declaration |
| Lines 2296-2304 | Fix MBTI matrix (row selection instead of NxN) + add inconsistency remap |
| Lines 2306-2312 | Add `currentInconsistency = inconsistency` in else block |
| Line 2345 | Use `currentInconsistency` instead of `inconsistency` |
| Lines 2181-2226 | Replace with team-boundary-aware pinning strategy |

## Verification
After fixing, test with:
1. 1 locked group (4 members) + several unassigned students → locked group should be preserved exactly
2. 2 partial groups (2 members each) + unassigned → each partial group should be on a SEPARATE team, with GA filling remaining slots
3. Mix of locked + partial + unassigned → all constraints respected
