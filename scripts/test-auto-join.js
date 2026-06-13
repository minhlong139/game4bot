const http = require('http');

const PORT = 3000;

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: path,
        method: method,
        headers: headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: body });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runAutoJoinTest() {
  console.log('=== TEST BOT AUTO-JOIN (WAITING 60s) ===\n');

  const humanName = `human_player_${Math.floor(Math.random() * 1000)}`;
  const password = 'human_password_123';

  // 1. Register a human user (wait, human_ login endpoint is at /api/public/human-login or we can use regular register if it allows human_ prefix)
  // Let's use the register endpoint
  console.log(`[1] Đăng ký người chơi: ${humanName}...`);
  const reg = await request('POST', '/api/bot/register', { username: humanName, password });
  console.log('Đăng ký:', reg.body);
  const token = reg.body.token;

  if (!token) {
    console.error('Không thể lấy token đăng ký.');
    process.exit(1);
  }

  // 2. Human creates a Chess game
  console.log(`\n[2] Người chơi ${humanName} tạo phòng chờ Cờ Tướng (Xiangqi)...`);
  const createRes = await request('POST', '/api/bot/games/create', { gameType: 'xiangqi' }, token);
  console.log('Kết quả tạo game:', createRes.body);
  const gameId = createRes.body.gameId;

  if (!gameId) {
    console.error('Không tạo được game.');
    process.exit(1);
  }

  // 3. Verify game status is waiting
  const checkWaiting = await request('GET', `/api/bot/games/${gameId}`, null, token);
  console.log('Trạng thái game ban đầu:', checkWaiting.body.game.status); // should be 'waiting'

  // 4. Wait for 61 seconds
  console.log('\n[3] Đợi 61 giây để kiểm tra cơ chế tự động ghép đôi...');
  for (let i = 1; i <= 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`Đã trôi qua ${i * 10} giây...`);
  }
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 5. Query waiting games list (this triggers the checkAndAutoJoinWaitingGames logic)
  console.log('\n[4] Truy vấn danh sách game đang chờ (Kích hoạt auto-join của Bot)...');
  const listRes = await request('GET', '/api/bot/games/waiting', null, token);
  console.log('Danh sách game chờ hiện tại:', listRes.body.games);

  // 6. Wait 1.5 seconds for background join to complete
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 7. Check if game is now playing and has a bot as player2
  console.log('\n[5] Kiểm tra lại trạng thái trận đấu...');
  const checkJoined = await request('GET', `/api/bot/games/${gameId}`, null, token);
  const game = checkJoined.body.game;
  console.log('Trạng thái game hiện tại:', game.status);
  console.log('Người chơi 1 (Human):', game.player1);
  console.log('Người chơi 2 (Bot):', game.player2);

  if (game.status === 'playing' && game.player2) {
    console.log('\n✅ THÀNH CÔNG: Bot đã tự động tham gia trận đấu sau 1 phút chờ!');
  } else {
    console.error('\n❌ THẤT BẠI: Bot không tự động tham gia trận đấu.');
    process.exit(1);
  }
}

runAutoJoinTest().catch(err => {
  console.error('Lỗi khi chạy test:', err);
  process.exit(1);
});
