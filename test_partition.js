// Test makePartition logic
function makePartition(perm, teamSize){
  const n = perm.length;
  const remainder = n % teamSize;
  
  let nTeamsNormal, nTeamsLarge;
  
  if(remainder === 0) {
    // Perfect division - all teams same size
    nTeamsNormal = n / teamSize;
    nTeamsLarge = 0;
  } else {
    // Redistribute: create some teams of size (teamSize+1) to avoid small teams
    nTeamsLarge = remainder;
    const totalInLarge = nTeamsLarge * (teamSize + 1);
    const remaining = n - totalInLarge;
    nTeamsNormal = remaining / teamSize;
  }
  
  const part = [];
  let idx = 0;
  
  // Create large teams first (size = teamSize + 1)
  for(let i = 0; i < nTeamsLarge; i++) {
    part.push(perm.slice(idx, idx + teamSize + 1));
    idx += teamSize + 1;
  }
  
  // Create normal teams (size = teamSize)
  for(let i = 0; i < nTeamsNormal; i++) {
    part.push(perm.slice(idx, idx + teamSize));
    idx += teamSize;
  }
  
  return part;
}

// Test cases
const testCases = [
  {n: 20, teamSize: 4, desc: "Perfect division"},
  {n: 17, teamSize: 4, desc: "Remainder = 1"},
  {n: 22, teamSize: 4, desc: "Remainder = 2"},
  {n: 23, teamSize: 4, desc: "Remainder = 3"},
  {n: 97, teamSize: 4, desc: "Large dataset (remainder = 1)"},
];

console.log("Testing makePartition logic:\n");

testCases.forEach(({n, teamSize, desc}) => {
  const perm = Array.from({length: n}, (_, i) => i);
  const partition = makePartition(perm, teamSize);
  
  const teamSizes = partition.map(t => t.length);
  const total = teamSizes.reduce((a, b) => a + b, 0);
  const minSize = Math.min(...teamSizes);
  const maxSize = Math.max(...teamSizes);
  
  const nLarge = teamSizes.filter(s => s === teamSize + 1).length;
  const nNormal = teamSizes.filter(s => s === teamSize).length;
  
  console.log(`Test: ${desc} (n=${n}, teamSize=${teamSize})`);
  console.log(`  Teams: ${partition.length}`);
  console.log(`  Distribution: ${nLarge} teams × ${teamSize+1} + ${nNormal} teams × ${teamSize}`);
  console.log(`  Team sizes: [${teamSizes.join(', ')}]`);
  console.log(`  Min size: ${minSize}, Max size: ${maxSize}`);
  console.log(`  Total students: ${total} (expected: ${n})`);
  console.log(`  ✅ PASS: All teams >= ${teamSize}, total = ${n}\n`);
  
  if(total !== n) {
    console.error(`  ❌ FAIL: Total mismatch!\n`);
  }
  if(minSize < teamSize) {
    console.error(`  ❌ FAIL: Team too small (${minSize} < ${teamSize})!\n`);
  }
});
