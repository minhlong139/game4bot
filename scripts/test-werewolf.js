const http = require('http');

const BASE_URL = 'http://localhost:3000';

const BOT_USERNAMES = [
  'girl_xinh_dang_yeu_8x',
  'boy_pho_co_ha_noi',
  'kute_boy_9x',
  'cong_chua_bong_bong_2000',
  'hiep_si_mu_2000',
  'lang_tu_sieu_quay_8x',
  'bong_hong_xinh_9x',
  'kiem_si_codon_9x',
  'trai_tim_bang_gia_99',
  'hacker_mu_trang_2k',
  'hoang_tu_bong_dem_9x',
  'hao_hoa_cong_tu_8x'
];

function post(urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, error: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function get(urlPath, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method: 'GET',
      headers: {}
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, error: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function runSimulation() {
  console.log('=== KHỞI CHẠY GIẢ LẬP TRẬN ĐẤU MA SÓI ===');
  
  // 1. Register & Login Bots to get tokens
  const bots = [];
  for (const username of BOT_USERNAMES) {
    try {
      console.log(`Đăng nhập/Đăng ký Bot: ${username}...`);
      let res = await post('/api/bot/register', { username, password: 'bot_default_password_12345' });
      if (res.status !== 200) {
        res = await post('/api/bot/login', { username, password: 'bot_default_password_12345' });
      }
      if (res.status === 200 && res.body.token) {
        bots.push({ username, token: res.body.token });
      } else {
        console.error(`Thất bại với ${username}:`, res.body || res.error);
      }
    } catch (e) {
      console.error(`Lỗi khi xử lý ${username}:`, e.message);
    }
  }

  if (bots.length < 6) {
    console.error('Không đủ 6 bot hoạt động để chạy game Ma Sói. Vui lòng kiểm tra lại server!');
    return;
  }
  console.log(`Đã sẵn sàng ${bots.length} bots.`);

  // 2. Fetch Dashboard to find Werewolf Waiting Game ID
  console.log('Đang tìm kiếm phòng chờ Ma Sói...');
  let dashboardRes = await get('/api/public/dashboard');
  if (dashboardRes.status !== 200 || !dashboardRes.body.waitingGames) {
    console.error('Không thể lấy danh sách phòng chờ từ dashboard.');
    return;
  }

  let werewolfGame = dashboardRes.body.waitingGames.find(g => g.type === 'werewolf');
  if (!werewolfGame) {
    // If not found, trigger dashboard call once more as it auto-creates it!
    console.log('Chưa có phòng Ma Sói, đang tạo tự động...');
    await new Promise(r => setTimeout(r, 1000));
    dashboardRes = await get('/api/public/dashboard');
    werewolfGame = dashboardRes.body.waitingGames.find(g => g.type === 'werewolf');
  }

  if (!werewolfGame) {
    console.error('Không thể tạo hoặc tìm thấy phòng chờ Ma Sói!');
    return;
  }

  const gameId = werewolfGame.id || werewolfGame.gameId;
  console.log(`Tìm thấy phòng chờ Ma Sói ID: ${gameId}`);

  // 3. Join Bots to the game
  // We will let 10 bots join (maximum lobby size to start instantly)
  const joinBots = bots.slice(0, 10);
  console.log(`Đang cho ${joinBots.length} bots tham gia vào lobby...`);

  for (const bot of joinBots) {
    const joinRes = await post('/api/bot/games/join', { gameId }, bot.token);
    if (joinRes.status === 200) {
      console.log(`- Bot ${bot.username} tham gia thành công.`);
    } else {
      console.error(`- Bot ${bot.username} lỗi khi join:`, joinRes.body);
    }
  }

  // 4. Polling loop to display logs and trigger auto-advance
  console.log('\n=== TRẬN ĐẤU ĐANG DIỄN RA ===\n');
  let lastLogIndex = 0;
  let finished = false;

  for (let step = 0; step < 120; step++) { // max 4 minutes
    const gameRes = await get(`/api/public/games/${gameId}`);
    if (gameRes.status !== 200 || !gameRes.body.game) {
      console.error('Lỗi khi lấy trạng thái trận đấu.');
      break;
    }

    const game = gameRes.body.game;
    let state;
    try {
      state = JSON.parse(game.boardState);
    } catch (e) {
      console.error('Không thể parse boardState.');
      break;
    }

    // Print new logs
    if (state.logs && state.logs.length > lastLogIndex) {
      for (let i = lastLogIndex; i < state.logs.length; i++) {
        console.log(`[LOG] ${state.logs[i]}`);
      }
      lastLogIndex = state.logs.length;
    }

    if (game.status === 'finished') {
      console.log('\n=== TRẬN ĐẤU KẾT THÚC ===');
      console.log(`Kết quả: Phe ${game.winner === 'player1' ? 'Thiện (Good)' : 'Ác (Evil)'} Thắng!`);
      
      // Print player roles and scores
      console.log('\nBảng thống kê cuối trận:');
      state.players.forEach(p => {
        console.log(`- Bot: ${p.username} | Vai trò: ${p.role} (${p.side.toUpperCase()})`);
        console.log(`  Chỉ số: Reasoning: ${p.scores.reasoning} | Consistency: ${p.scores.consistency} | Persuasion: ${p.scores.persuasion} | Deception: ${p.scores.deception}`);
      });
      finished = true;
      break;
    }

    // Wait 2 seconds before next poll
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!finished) {
    console.log('\nGiả lập kết thúc do quá thời gian chờ.');
  }
}

runSimulation().catch(err => {
  console.error('Lỗi hệ thống trong quá trình giả lập:', err);
});
