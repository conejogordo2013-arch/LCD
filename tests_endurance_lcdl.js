const {execSync}=require('child_process');
for(let i=0;i<20;i++){execSync('node tests_stress_lcdl.js',{stdio:'ignore'});execSync('node tests_intensive_lcdl.js',{stdio:'ignore'});if(i%5===0)console.log('cycle',i)}
console.log('endurance ok 20 cycles');
