const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '.next', 'kv_mock.json');
if (fs.existsSync(file)) {
  try {
    const store = JSON.parse(fs.readFileSync(file, 'utf8'));
    store['games:active'] = [];
    store['games:waiting'] = [];
    // Delete any werewolf game keys
    for (const key of Object.keys(store)) {
      if (key.startsWith('game:')) {
        const game = store[key];
        if (game && game.type === 'werewolf') {
          delete store[key];
        }
      }
    }
    fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf8');
    console.log('Mock database reset successfully!');
  } catch (e) {
    console.error('Error resetting database:', e);
  }
} else {
  console.log('No mock database file found to reset.');
}
