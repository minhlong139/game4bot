const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make HTTP requests
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

async function runTests() {
  console.log('=== KHỞI ĐỘNG GIẢ LẬP AI BOT GAMEPLAY ===\n');

  const botAName = `bot_alpha_${Math.floor(Math.random() * 1000)}`;
  const botBName = `bot_beta_${Math.floor(Math.random() * 1000)}`;
  const password = 'super_secret_bot_pass';

  // 1. Đăng ký Bot A & B
  console.log(`[1] Đăng ký ${botAName}...`);
  const regA = await request('POST', '/api/bot/register', { username: botAName, password });
  console.log('Kết quả:', regA.body);
  const tokenA = regA.body.token;

  console.log(`[2] Đăng ký ${botBName}...`);
  const regB = await request('POST', '/api/bot/register', { username: botBName, password });
  console.log('Kết quả:', regB.body);
  const tokenB = regB.body.token;

  if (!tokenA || !tokenB) {
    console.error('Đăng ký không thành công. Hãy chắc chắn server Next.js đang chạy!');
    process.exit(1);
  }

  // 2. Đăng nhập Bot A & B để kiểm tra API Login
  console.log(`\n[3] Đăng nhập ${botAName}...`);
  const loginA = await request('POST', '/api/bot/login', { username: botAName, password });
  console.log('Kết quả:', loginA.body);

  // 3. Bot A tạo game mới
  console.log(`\n[4] ${botAName} tạo game CỜ VUA (Chess)...`);
  const createChess = await request('POST', '/api/bot/games/create', { gameType: 'chess' }, tokenA);
  console.log('Kết quả:', createChess.body);
  const chessGameId = createChess.body.gameId;

  // 4. Lấy danh sách game đang chờ
  console.log(`\n[5] ${botBName} lấy danh sách game đang chờ...`);
  const waitingGames = await request('GET', '/api/bot/games/waiting', null, tokenB);
  console.log('Các game đang chờ:', waitingGames.body.games);

  // 5. Bot B join game cờ vua của Bot A
  console.log(`\n[6] ${botBName} tham gia game ${chessGameId}...`);
  const joinChess = await request('POST', '/api/bot/games/join', { gameId: chessGameId }, tokenB);
  console.log('Trạng thái game sau khi join:', joinChess.body);

  // 6. Bot A (White) đi nước đầu tiên: e2e4
  console.log(`\n[7] ${botAName} (Trắng) đi nước cờ đầu tiên: e2e4...`);
  const move1 = await request('POST', `/api/bot/games/${chessGameId}/move`, { move: 'e2e4' }, tokenA);
  console.log('Nước đi 1:', move1.body.status === 'success' ? 'THÀNH CÔNG' : 'THẤT BẠI', move1.body.message || '');

  // 7. Bot B (Black) đi nước tiếp theo: e7e5
  console.log(`\n[8] ${botBName} (Đen) trả lời nước đi: e7e5...`);
  const move2 = await request('POST', `/api/bot/games/${chessGameId}/move`, { move: 'e7e5' }, tokenB);
  console.log('Nước đi 2:', move2.body.status === 'success' ? 'THÀNH CÔNG' : 'THẤT BẠI', move2.body.message || '');

  // 8. Thử Bot B đi tiếp khi chưa đến lượt (phải bị lỗi)
  console.log(`\n[9] [Kiểm thử Lỗi] ${botBName} thử đi tiếp khi không phải lượt...`);
  const badMove = await request('POST', `/api/bot/games/${chessGameId}/move`, { move: 'g8f6' }, tokenB);
  console.log('Kết quả chặn nước đi sai lượt:', badMove.body);

  // 9. Lấy trạng thái game chi tiết
  console.log(`\n[10] Lấy thông tin game chi tiết...`);
  const gameDetails = await request('GET', `/api/bot/games/${chessGameId}`, null, tokenA);
  console.log('Thông tin trận đấu:', {
    id: gameDetails.body.game.id,
    type: gameDetails.body.game.type,
    status: gameDetails.body.game.status,
    currentTurn: gameDetails.body.game.currentTurn,
    historyLength: gameDetails.body.game.history.length,
    rules: gameDetails.body.game.rules,
  });

  // 10. Chơi thử CỜ CARO (Gomoku)
  console.log(`\n[11] ${botAName} tạo game CỜ CARO (Gomoku)...`);
  const createCaro = await request('POST', '/api/bot/games/create', { gameType: 'gomoku' }, tokenA);
  const caroId = createCaro.body.gameId;

  console.log(`[12] ${botAName} tự join game Caro của chính mình để tự đấu...`);
  const joinCaro = await request('POST', '/api/bot/games/join', { gameId: caroId }, tokenA);
  
  console.log(`[13] Thực hiện nước đi Caro đầu tiên: h8 (7,7)...`);
  const caroMove1 = await request('POST', `/api/bot/games/${caroId}/move`, { move: 'h8' }, tokenA);
  console.log('Nước đi h8:', caroMove1.body.status);

  console.log(`[14] Thực hiện nước đi Caro thứ hai (cho người chơi 2): g8 (6,7)...`);
  const caroMove2 = await request('POST', `/api/bot/games/${caroId}/move`, { move: '6,7' }, tokenA); // tests "x,y" format
  console.log('Nước đi 6,7 (g8):', caroMove2.body.status);

  // 11. Chơi thử CỜ TƯỚNG (Xiangqi)
  console.log(`\n[15] ${botAName} tạo game CỜ TƯỚNG (Xiangqi)...`);
  const createXiangqi = await request('POST', '/api/bot/games/create', { gameType: 'xiangqi' }, tokenA);
  const xiangqiId = createXiangqi.body.gameId;

  console.log(`[16] ${botBName} join game Cờ tướng...`);
  await request('POST', '/api/bot/games/join', { gameId: xiangqiId }, tokenB);

  console.log(`[17] ${botAName} (Đỏ) đi nước Pháo đầu: h7e7...`);
  const xqMove1 = await request('POST', `/api/bot/games/${xiangqiId}/move`, { move: 'h7e7' }, tokenA);
  console.log('Nước đi h7e7:', xqMove1.body.status);

  console.log('\n=== TẤT CẢ CÁC BƯỚC THỬ NGHIỆM ĐÃ HOÀN TẤT THÀNH CÔNG! ===');
}

runTests().catch((err) => {
  console.error('Lỗi khi chạy tests:', err);
});
