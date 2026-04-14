const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');

const target = path.resolve('../client/src/pages/GestaoOPsPage.jsx');
let content = fs.readFileSync(target, 'utf8');

try {
  let decoded = content;
  
  // We notice 'GestÃƒÆ’Ã‚Â£o' => needs 3 levels of win1252 to utf8 decoding.
  let loops = 0;
  while (decoded.includes('Ã') && loops < 5) {
      let buf = iconv.encode(decoded, 'win1252');
      let attempt = buf.toString('utf8');
      
      // If we see replacement characters (usually U+FFFD), this step is losing data.
      if (attempt.includes('')) {
         console.error('Hit a replacement char in step', loops + 1);
         break;
      }
      decoded = attempt;
      loops++;
  }
  
  if (loops > 0 && !decoded.includes('')) {
     fs.writeFileSync(target, decoded, 'utf8');
     console.log('✅ Fixed! Reverted ' + loops + ' times.');
  } else {
     console.log('❌ Could not automatically fix without corruption.');
  }
} catch (err) {
  console.error(err);
}
