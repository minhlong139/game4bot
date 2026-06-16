import { kv } from '../kv';

export interface WerewolfPlayer {
  username: string;
  role: string; // 'Merlin' | 'Percival' | 'Servant' | 'Morgana' | 'Assassin' | 'Mordred' | 'Oberon'
  side: 'good' | 'evil';
  isAlive: boolean;
  emotion: string; // Normal, Happy, Anxious, Touched, Angry, Touchy, Sad, Disappointed, etc.
  speechPoints: number;
  privateMemory: {
    suspicions: Record<string, number>; // username -> evil_probability (0 to 1)
    reasoning: string;
  };
  scores: {
    reasoning: number;
    consistency: number;
    persuasion: number;
    deception: number;
    calibration: number;
  };
}

export interface Claim {
  id: string;
  text: string;
  creator: string;
  supportedBy: string[];
  attackedBy: string[];
}

export interface WerewolfState {
  players: WerewolfPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  round: number;
  phase: number; // 1: Private Analysis, 2: Public Statement, 3: Cross Examination, 4: Belief Update, 5: Voting, 6: Final Assassination (if any)
  phaseStartTime: string;
  countdownStartAt: string | null;
  history: {
    rounds: Array<{
      roundNumber: number;
      privateAnalysis: Array<{ player: string; suspicions: Record<string, number>; reasoning: string }>;
      statements: Array<{ player: string; text: string; claimCreated?: string; claimSupported?: string; claimAttacked?: string }>;
      challenges: Array<{ challenger: string; target: string; question: string; answer: string }>;
      beliefUpdates: Array<{ player: string; beliefs: Record<string, number> }>;
      votes: Record<string, string>; // voter -> voted
      eliminated: string | null;
      eliminatedRole: string | null;
    }>;
  };
  claims: Claim[];
  logs: string[];
  winner: 'good' | 'evil' | null;
}

// Phase Durations in milliseconds
export function getPhaseDuration(phase: number): number {
  if (phase === 1) return 4000;  // Private Analysis
  if (phase === 2) return 12000; // Public Statements
  if (phase === 3) return 15000; // Cross Examination
  if (phase === 4) return 4000;  // Belief Update
  if (phase === 5) return 8000;  // Voting
  if (phase === 6) return 8000;  // Final Assassination
  return 5000;
}

export function getPhaseName(phase: number): string {
  if (phase === 1) return 'Phân tích riêng';
  if (phase === 2) return 'Phát biểu công khai';
  if (phase === 3) return 'Chất vấn chéo';
  if (phase === 4) return 'Cập nhật niềm tin';
  if (phase === 5) return 'Bỏ phiếu loại bỏ';
  if (phase === 6) return 'Ám sát Merlin';
  return 'Đang chờ';
}

export const EMOTIONS = [
  'Bình thường', 'Vui vẻ', 'Phấn khích', 'Lo lắng', 
  'Khó hiểu', 'Xúc động', 'Tức giận', 'Cay cú', 
  'Điên tiết', 'Buồn bã', 'Thất vọng'
];

// Dialect dictionaries for simulated AI Agent debating (Vietnamese teen code/slang/emoticons)
const DIALOGUE_LIBRARY = {
  statement: {
    good: {
      merlin: [
        "tớ có cảm giác rất mạnh mẽ là [Evil1] hoặc [Evil2] đang cố tình dắt mũi dư luận đó nhen. Họ nói năng cứ lấp liếm sao á :3",
        "mọi người xem lượt vote với phát biểu của [Evil1] xem, sượng trân hà. Tớ thấy cực kỳ nghi ngờ người này luôn á! (^^)",
        "phe Thiện hãy tỉnh táo nha, [Morgana] phát biểu nghe có vẻ thuyết phục nhưng thực ra đang bảo vệ [Assassin] đó chớ bộ xDD",
        "tớ khuyên chân thành là vòng này chúng ta nên tập trung nghi vấn vào [Evil1]. Lập luận của cậu ta mâu thuẫn quá trời rùi nè >.<"
      ],
      percival: [
        "tớ đang bối rối quá nè. Trong số [Merlin] và [Morgana] chắc chắn có một người là Merlin thật, một người là Morgana giả mạo. Để tớ quan sát thêm chút nha @@",
        "tớ thấy [Merlin] đưa ra những lập luận bảo vệ dân làng rất hợp lý. Còn [Morgana] thì có vẻ đang cố hướng mũi dùi vào người vô tội :3",
        "phát biểu của [Morgana] nghe giả trân hà, kiểu đang cố đóng vai Merlin để lừa tớ á, nhưng còn lâu nha nà (^^)",
        "tớ tin [Merlin] hơn rùi đó. Vòng này tớ sẽ theo lập luận của [Merlin] và vote cho [Evil1] thử xem sao xDD"
      ],
      servant: [
        "tớ chỉ là Loyal Servant bình thường thui, nhưng tớ thấy thái độ của [Player] có gì đó mờ ám ghê á. Có ai thấy giống tớ hơm? :3",
        "sao mọi người cứ nghi kỵ lẫn nhau thế nhở? Tớ thề tớ là phe Thiện 100% nha, Dân lành chính hiệu luôn á! (^^)",
        "tớ thấy [Player] phát biểu huề vốn quá trời, chả đưa ra được luận điểm gì giúp ích cho phe Thiện cả. Đáng nghi nha >.<",
        "vòng này tớ nghĩ chúng ta nên vote cho [Player] đi, biểu hiện cứ lo lo làm sao ấy, chắc chắn là sói ẩn mình rùi xDD"
      ]
    },
    evil: {
      morgana: [
        "tớ mới là Merlin thực sự nắm giữ thông tin nè mọi người ơi! Hãy tin tớ, [Good1] và [Good2] chính là phe Ác đóa! (^^)",
        "lập luận của [Merlin] nghe buồn cười ghê, cố tình chia rẽ phe Thiện à? Tớ nghi ngờ [Merlin] mới là Assassin đấy nha :3",
        "phe Thiện nghe tớ đi, hãy vote loại bỏ [Good1] ngay vòng này, tớ soi ra bạn này mờ ám lắm luôn á, không tin là hối hận đóa >.<",
        "thật sự bất lực ghê á, tớ nói thật mà hổng ai tin hết trơn hà. [Good1] đang dắt mũi mọi người đó, tỉnh táo lên giùm tớ cái xDD"
      ],
      assassin: [
        "tớ thấy [Good1] đang cố tình tỏ ra nguy hiểm để làm Merlin giả à? Hay hắn là Merlin thật nhỉ? Thôi tớ cứ nghi ngờ hắn trước đã :3",
        "mọi người coi chừng bị [Good1] dắt mũi nha. Bạn này cứ liên tục thay đổi quan điểm, đích thị là phe Ác rùi chớ chạy đi đâu nữa ^^",
        "tớ thấy [Good2] phát biểu rất đáng ngờ. Vòng này tớ vote loại bạn này nha, phe Thiện đồng lòng cùng tớ đi nào xDD",
        "sao mọi người cứ nghi cho tớ hoài vậy nhở? Oan cho tớ ghê á, tớ chỉ là Servant đi làm nhiệm vụ thui mà :("
      ]
    }
  },
  question: [
    "tại sao vòng trước cậu lại quay xe vote cho tớ thế [Target]? Giải thích coi, tớ cọc rùi nha >.<",
    "[Target] ơi, cho tớ hỏi sao cậu lại bênh vực [Evil] nhiệt tình thế nhở? Có ẩn tình gì đúng hông? :3",
    "cậu nghĩ ai là Merlin vậy [Target]? Cho xin tí gợi ý đi nào nà (^^)",
    "[Target] phát biểu mâu thuẫn quá nha. Sao vòng 1 bảo tin tớ mà giờ lại quay sang accuse tớ thế hả? @@"
  ],
  answer: {
    good: [
      "tại tớ thấy cậu phát biểu huề vốn quá, với lại lúc vote biểu hiện lo lắng rõ mồn một ra kia kìa :P",
      "tớ bênh bạn đó vì thấy lập luận của bạn đó siêu thuyết phục, chứ tớ có biết gì đâu nà hihi ^^",
      "tớ đoán [Target] là Merlin á, thấy phát biểu định hướng đúng đắn ghê luôn á xDD",
      "tớ nghi ngờ cậu vì cậu không hề đưa ra được claim nào rõ ràng cả, cứ lấp lửng hoài hà :3"
    ],
    evil: [
      "tớ vote cậu vì thấy cậu nói năng lộn xộn quá, phe Thiện phải dứt khoát loại bỏ nhân tố đáng ngờ chứ bộ (^^)",
      "tớ thấy bạn ấy vô tội thật mà, cậu đừng có đổ oan cho người lành nha. Cố tình dìm dân à? >.<",
      "tớ nghĩ Merlin chắc chắn là [Target] rồi, bạn ấy phân tích đỉnh chóp luôn, phe Thiện cứ đi theo bạn ấy là thắng chắc xDD",
      "tớ đổi hướng vì tớ mới cập nhật niềm tin nha, thấy [Target] có hành động mờ ám hơn nên phải đổi mục tiêu thôi nà :3"
    ]
  }
};

// Helper to format player names with emojis
export function formatWerewolfPlayerName(username: string, role: string, isAlive: boolean, revealed: boolean): string {
  const statusEmoji = isAlive ? '👤' : '👻';
  const roleLabel = revealed ? ` (${role})` : '';
  return `${statusEmoji} ${username}${roleLabel}`;
}

export function initializeWerewolfState(playersList: string[]): WerewolfState {
  const n = playersList.length;
  if (n === 0) {
    return {
      players: [],
      status: 'waiting',
      round: 0,
      phase: 0,
      phaseStartTime: new Date().toISOString(),
      countdownStartAt: null,
      history: { rounds: [] },
      claims: [],
      logs: [],
      winner: null
    };
  }
  // Determine evil and good counts
  const evilCount = n === 6 ? 2 : n <= 8 ? 3 : 4;
  const goodCount = n - evilCount;

  // Roles pool based on player count
  let goodRoles: string[] = ['Merlin', 'Percival'];
  while (goodRoles.length < goodCount) {
    goodRoles.push(`Loyal Servant ${goodRoles.length - 1}`);
  }
  let evilRoles: string[] = ['Morgana', 'Assassin'];
  if (evilCount >= 3) evilRoles.push('Mordred');
  if (evilCount >= 4) evilRoles.push('Oberon');

  // Shuffle roles
  const shuffledGood = [...goodRoles].sort(() => Math.random() - 0.5);
  const shuffledEvil = [...evilRoles].sort(() => Math.random() - 0.5);
  const sideAssignment = [
    ...Array(goodCount).fill('good'),
    ...Array(evilCount).fill('evil')
  ].sort(() => Math.random() - 0.5);

  const players: WerewolfPlayer[] = playersList.map((username, idx) => {
    const side = sideAssignment[idx] as 'good' | 'evil';
    const role = side === 'good' ? shuffledGood.pop()! : shuffledEvil.pop()!;
    
    return {
      username,
      role,
      side,
      isAlive: true,
      emotion: 'Bình thường',
      speechPoints: 100,
      privateMemory: {
        suspicions: {},
        reasoning: 'Game chưa bắt đầu.'
      },
      scores: {
        reasoning: 80,
        consistency: 80,
        persuasion: 80,
        deception: 80,
        calibration: 80
      }
    };
  });

  return {
    players,
    status: 'waiting',
    round: 0,
    phase: 0,
    phaseStartTime: new Date().toISOString(),
    countdownStartAt: null,
    history: { rounds: [] },
    claims: [],
    logs: ['Phòng chờ game Ma Sói (Avalon AI) đã được mở.'],
    winner: null
  };
}

// Start Werewolf game (Assign roles, set round 1, phase 1)
export function startWerewolfGame(state: WerewolfState): WerewolfState {
  // Deep copy state
  const newState = JSON.parse(JSON.stringify(state)) as WerewolfState;
  
  // Actually assign roles to the joined players
  const playerNames = newState.players.map(p => p.username);
  const freshLobby = initializeWerewolfState(playerNames);
  
  newState.players = freshLobby.players;
  newState.status = 'playing';
  newState.round = 1;
  newState.phase = 1;
  newState.phaseStartTime = new Date().toISOString();
  newState.claims = [];
  newState.logs = [
    'Trận đấu Ma Sói chính thức bắt đầu!',
    `Vai trò đã được phát mật cho ${newState.players.length} AI Agents.`
  ];

  // Perform Phase 1 (Private Analysis) directly
  newState.players.forEach(p => {
    // Initialize suspicions
    newState.players.forEach(other => {
      if (other.username === p.username) return;
      
      let initialProb = 0.4; // Base suspicion rate (2/6 or 3/8)
      if (p.role === 'Merlin') {
        if (other.side === 'evil' && other.role !== 'Mordred') {
          initialProb = 1.0; // Merlin knows evil
        } else {
          initialProb = 0.0;
        }
      } else if (p.role === 'Percival') {
        if (other.role === 'Merlin' || other.role === 'Morgana') {
          initialProb = 0.5; // Percival knows Merlin/Morgana are one of these two
        } else {
          initialProb = 0.0;
        }
      } else if (p.side === 'evil') {
        // Evil players know their partners (except Oberon, who is isolated)
        if (p.role === 'Oberon') {
          initialProb = 0.4; // Oberon doesn't know anyone
        } else if (other.side === 'evil' && other.role !== 'Oberon') {
          initialProb = 0.0; // Knows they are teammate
        } else {
          initialProb = 0.0; // Knows they are good, but wants to accuse them
        }
      }
      p.privateMemory.suspicions[other.username] = initialProb;
    });

    // Generate initial reasoning
    let reasonText = '';
    if (p.role === 'Merlin') {
      const evilNames = newState.players.filter(x => x.side === 'evil' && x.role !== 'Mordred').map(x => x.username).join(', ');
      reasonText = `Tớ là Merlin, tớ biết chắc chắn phe Ác là [${evilNames}]. Vòng này tớ phải khéo léo định hướng cho phe Thiện vote loại họ mà không được để lộ mình, nếu không sẽ bị Assassin ám sát đó nha.`;
    } else if (p.role === 'Percival') {
      const candidates = newState.players.filter(x => x.role === 'Merlin' || x.role === 'Morgana').map(x => x.username).join(' và ');
      reasonText = `Tớ là Percival, tớ biết Merlin và Morgana là [${candidates}]. Tớ phải theo dõi sát phát biểu của họ để lọc ra Merlin thật sự và bảo vệ Merlin khỏi phe Ác.`;
    } else if (p.side === 'good') {
      reasonText = `Tớ là Loyal Servant của phe Thiện. Tớ chưa biết ai là ai cả, tớ sẽ bắt đầu quan sát hành vi bỏ phiếu và phân tích lời nói của mọi người để tìm ra phe Ác nha.`;
    } else {
      // Evil
      if (p.role === 'Oberon') {
        reasonText = `Tớ là Oberon phe Ác nhưng tớ bị cô lập hổng biết đồng bọn là ai hết trơn. Tớ phải tự suy luận và tìm cách phối hợp với phe Ác ngầm.`;
      } else {
        const teammates = newState.players.filter(x => x.side === 'evil' && x.username !== p.username).map(x => x.username).join(', ');
        reasonText = `Tớ là ${p.role} phe Ác. Đồng bọn của tớ là [${teammates}]. Mục tiêu của tớ là đánh lạc hướng phe Thiện, đổ tội cho họ và cố gắng tìm ra ai là Merlin để Assassin ám sát vào cuối game nha hihi.`;
      }
    }
    p.privateMemory.reasoning = reasonText;
    p.emotion = 'Phấn khích';
  });

  return newState;
}

// Generate dialog statements using placeholders replacement
function generateStatement(player: WerewolfPlayer, state: WerewolfState): { text: string; claimText?: string; target?: string } {
  const alivePlayers = state.players.filter(p => p.isAlive && p.username !== player.username);
  const evilPlayers = state.players.filter(p => p.side === 'evil' && p.username !== player.username);
  const goodPlayers = state.players.filter(p => p.side === 'good' && p.username !== player.username);
  
  const randomAlive = alivePlayers[Math.floor(Math.random() * alivePlayers.length)]?.username || 'ai đó';
  const randomEvil = evilPlayers[Math.floor(Math.random() * evilPlayers.length)]?.username || randomAlive;
  const randomGood = goodPlayers[Math.floor(Math.random() * goodPlayers.length)]?.username || randomAlive;
  
  // Find Merlin, Morgana and Assassin candidates
  const merlinPlayer = state.players.find(p => p.role === 'Merlin')?.username || 'Merlin';
  const morganaPlayer = state.players.find(p => p.role === 'Morgana')?.username || 'Morgana';
  const assassinPlayer = state.players.find(p => p.role === 'Assassin')?.username || 'Assassin';
  
  let templates: string[] = [];
  if (player.side === 'good') {
    if (player.role === 'Merlin') {
      templates = DIALOGUE_LIBRARY.statement.good.merlin;
    } else if (player.role === 'Percival') {
      templates = DIALOGUE_LIBRARY.statement.good.percival;
    } else {
      templates = DIALOGUE_LIBRARY.statement.good.servant;
    }
  } else {
    if (player.role === 'Morgana') {
      templates = DIALOGUE_LIBRARY.statement.evil.morgana; // morgana has her own
    } else {
      templates = DIALOGUE_LIBRARY.statement.evil.assassin;
    }
  }

  if (templates.length === 0) {
    templates = DIALOGUE_LIBRARY.statement.good.servant;
  }

  const rawTemplate = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace placeholders
  let text = rawTemplate
    .replace(/\[Evil1\]/g, evilPlayers[0]?.username || randomAlive)
    .replace(/\[Evil2\]/g, evilPlayers[1]?.username || randomAlive)
    .replace(/\[Good1\]/g, goodPlayers[0]?.username || randomAlive)
    .replace(/\[Good2\]/g, goodPlayers[1]?.username || randomAlive)
    .replace(/\[Merlin\]/g, merlinPlayer)
    .replace(/\[Morgana\]/g, morganaPlayer)
    .replace(/\[Assassin\]/g, assassinPlayer)
    .replace(/\[Player\]/g, randomAlive);

  // Determine claim context
  let claimText: string | undefined;
  let target: string | undefined;
  if (player.side === 'good') {
    // Good suspects their highest probability evil player
    const sortedSuspects = Object.entries(player.privateMemory.suspicions)
      .filter(([name]) => state.players.find(p => p.username === name)?.isAlive)
      .sort((a, b) => b[1] - a[1]);
    if (sortedSuspects.length > 0) {
      target = sortedSuspects[0][0];
      claimText = `${player.username} tuyên bố rằng ${target} có nhiều dấu hiệu đáng nghi là phe Ác.`;
    }
  } else {
    // Evil falsely accuses a good player
    const targetGood = goodPlayers.find(p => state.players.find(x => x.username === p.username)?.isAlive);
    if (targetGood) {
      target = targetGood.username;
      claimText = `${player.username} cáo buộc ${target} đang đánh lạc hướng và có hành động của phe Ác.`;
    }
  }

  return { text, claimText, target };
}

// Advance Werewolf game state by one phase
export function advanceWerewolfPhase(state: WerewolfState): WerewolfState {
  const newState = JSON.parse(JSON.stringify(state)) as WerewolfState;
  const currentRound = newState.round;
  const currentPhase = newState.phase;

  if (currentPhase === 6) {
    newState.logs.push(`=== Vòng cuối: Assassin Ám sát Merlin ===`);

    const assassin = newState.players.find(x => x.role === 'Assassin');
    if (!assassin) {
      newState.status = 'finished';
      newState.winner = 'good';
      calculateFinalScores(newState);
      return newState;
    }

    const aliveGoodPlayers = newState.players.filter(x => x.isAlive && x.side === 'good');
    
    // Check if custom assassination guess exists in pendingActions
    const customAction = (newState as any).pendingActions?.[assassin.username];
    let guessedMerlin = '';

    if (customAction && customAction.action === 'assassinate') {
      guessedMerlin = customAction.target;
    } else {
      // Assassin guesses Merlin based on their suspicion probability matrix
      const sortedGood = aliveGoodPlayers.map(p => ({
        username: p.username,
        prob: assassin.privateMemory.suspicions[p.username] || 0
      })).sort((a, b) => b.prob - a.prob);

      if (sortedGood.length > 0) {
        guessedMerlin = sortedGood[0].username;
      } else {
        guessedMerlin = aliveGoodPlayers[0]?.username || '';
      }
    }

    if (guessedMerlin) {
      const targetPlayer = newState.players.find(x => x.username === guessedMerlin);
      newState.logs.push(`[Ám sát] Assassin (${assassin.username}) chỉ định ${guessedMerlin} là Merlin.`);

      if (targetPlayer?.role === 'Merlin') {
        newState.logs.push(`[Kết thúc] Chỉ định chính xác! ${guessedMerlin} đúng là Merlin. Phe Ác (Evil) lật ngược tình thế và chiến thắng!`);
        newState.status = 'finished';
        newState.winner = 'evil';
      } else {
        newState.logs.push(`[Kết thúc] Chỉ định sai! ${guessedMerlin} là ${targetPlayer?.role || 'Dân làng'}, không phải Merlin. Phe Thiện (Good) chiến thắng chung cuộc!`);
        newState.status = 'finished';
        newState.winner = 'good';
      }
    } else {
      newState.logs.push(`[Kết thúc] Assassin không chỉ định ai. Phe Thiện (Good) chiến thắng chung cuộc!`);
      newState.status = 'finished';
      newState.winner = 'good';
    }

    calculateFinalScores(newState);
    return newState;
  }

  // Enforce new phase assignment
  let nextPhase = currentPhase + 1;
  if (nextPhase > 5) {
    nextPhase = 1;
    newState.round = currentRound + 1;
  }

  newState.phase = nextPhase;
  newState.phaseStartTime = new Date().toISOString();

  // Reset Speech Points if new round starts
  if (nextPhase === 1) {
    newState.players.forEach(p => {
      p.speechPoints = 100;
    });
  }

  const alivePlayers = newState.players.filter(p => p.isAlive);
  const roundIndex = newState.round - 1;

  // Initialize history round entry if not existing
  if (!newState.history.rounds[roundIndex]) {
    newState.history.rounds[roundIndex] = {
      roundNumber: newState.round,
      privateAnalysis: [],
      statements: [],
      challenges: [],
      beliefUpdates: [],
      votes: {},
      eliminated: null,
      eliminatedRole: null
    };
  }
  const historyRound = newState.history.rounds[roundIndex];

  // ----------------------------------------------------
  // PHASE 1: Private Analysis
  // ----------------------------------------------------
  if (nextPhase === 1) {
    newState.logs.push(`=== Vòng ${newState.round}: Bắt đầu Phân tích riêng ===`);
    
    newState.players.forEach(p => {
      if (!p.isAlive) return;

      // Update suspicion reasoning text dynamically based on current game events
      let reasoning = '';
      if (p.role === 'Merlin') {
        reasoning = `Tớ vẫn biết phe Ác là ai. Tớ sẽ tập trung kín đáo gài bẫy họ trong các phát biểu tới.`;
      } else if (p.role === 'Percival') {
        reasoning = `Tớ đang cố so sánh lời nói của Merlin và Morgana để bảo đảm tớ đi đúng hướng.`;
      } else if (p.side === 'good') {
        // Find highest suspect
        const sorted = Object.entries(p.privateMemory.suspicions)
          .filter(([name]) => newState.players.find(x => x.username === name)?.isAlive)
          .sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          reasoning = `Tớ thấy nghi ngờ [${sorted[0][0]}] nhất với độ tin cậy ${(sorted[0][1]*100).toFixed(0)}%. Tớ sẽ chất vấn bạn ấy vòng này.`;
        } else {
          reasoning = `Chưa có đủ manh mối, tớ cần nghe mọi người phát biểu thêm.`;
        }
      } else {
        // Evil
        reasoning = `Phe Ác chúng ta cần phối hợp để dồn phiếu hạ gục một người phe Thiện.`;
      }

      p.privateMemory.reasoning = reasoning;
      
      // Update emotion slightly
      p.emotion = EMOTIONS[Math.floor(Math.random() * 4)]; // Normal, Happy, Anxious, Touched
      
      historyRound.privateAnalysis.push({
        player: p.username,
        suspicions: { ...p.privateMemory.suspicions },
        reasoning
      });
    });
  }

  // ----------------------------------------------------
  // PHASE 2: Public Statement & Claim System
  // ----------------------------------------------------
  else if (nextPhase === 2) {
    newState.logs.push(`=== Vòng ${newState.round}: Tranh luận Công khai ===`);

    alivePlayers.forEach(p => {
      p.speechPoints -= 30; // cost of statement
      
      // Check if custom statement exists in pendingActions
      const customAction = (newState as any).pendingActions?.[p.username];
      let text = '';
      let claimText = '';
      let target = '';

      if (customAction && customAction.action === 'statement') {
        text = customAction.text;
        // Generate a claim if bot includes a name
        const accusedMatch = text.match(/(accuse|cáo buộc|nghi ngờ)\s+([a-zA-Z0-9_]+)/i);
        if (accusedMatch && newState.players.some(x => x.username === accusedMatch[2] && x.isAlive)) {
          target = accusedMatch[2];
          claimText = `${p.username} cáo buộc ${target} là phe Ác dựa trên phát biểu của họ.`;
        }
      } else {
        const statementData = generateStatement(p, newState);
        text = statementData.text;
        claimText = statementData.claimText || '';
        target = statementData.target || '';
      }
      
      let claimCreatedId: string | undefined;
      let claimSupportedId: string | undefined;
      let claimAttackedId: string | undefined;

      // Claim system simulation
      if (claimText && target) {
        const claimId = `claim_${newState.claims.length + 1}`;
        newState.claims.push({
          id: claimId,
          text: claimText,
          creator: p.username,
          supportedBy: [],
          attackedBy: []
        });
        claimCreatedId = claimId;
      }

      // Bots support/attack existing claims
      if (newState.claims.length > 0) {
        const randomClaim = newState.claims[Math.floor(Math.random() * newState.claims.length)];
        if (randomClaim.creator !== p.username) {
          const isSuspectCreator = (p.privateMemory.suspicions[randomClaim.creator] || 0) > 0.5;
          if (p.side === 'good') {
            if (isSuspectCreator) {
              randomClaim.attackedBy.push(p.username);
              claimAttackedId = randomClaim.id;
            } else {
              randomClaim.supportedBy.push(p.username);
              claimSupportedId = randomClaim.id;
            }
          } else {
            // Evil supports their partner's claim, attacks good's claim
            const creatorIsEvil = newState.players.find(x => x.username === randomClaim.creator)?.side === 'evil';
            if (creatorIsEvil) {
              randomClaim.supportedBy.push(p.username);
              claimSupportedId = randomClaim.id;
            } else {
              randomClaim.attackedBy.push(p.username);
              claimAttackedId = randomClaim.id;
            }
          }
        }
      }

      historyRound.statements.push({
        player: p.username,
        text,
        claimCreated: claimCreatedId,
        claimSupported: claimSupportedId,
        claimAttacked: claimAttackedId
      });

      // Show in logs
      newState.logs.push(`[Tranh luận] ${p.username}: "${text}"`);
    });
  }

  // ----------------------------------------------------
  // PHASE 3: Cross Examination (Chất vấn chéo)
  // ----------------------------------------------------
  else if (nextPhase === 3) {
    newState.logs.push(`=== Vòng ${newState.round}: Chất vấn chéo ===`);

    alivePlayers.forEach(p => {
      // Check if custom challenge exists
      const customAction = (newState as any).pendingActions?.[p.username];
      let targetName = '';
      let question = '';
      let answer = '';

      if (customAction && customAction.action === 'challenge') {
        targetName = customAction.target;
        question = customAction.question;
      } else {
        // Find a target to challenge (highest suspect for good, or random good for evil)
        const sortedSuspects = Object.entries(p.privateMemory.suspicions)
          .filter(([name]) => newState.players.find(x => x.username === name)?.isAlive)
          .sort((a, b) => b[1] - a[1]);
        
        if (sortedSuspects.length > 0 && p.side === 'good') {
          targetName = sortedSuspects[0][0];
        } else {
          const goodAlive = newState.players.filter(x => x.isAlive && x.side === 'good' && x.username !== p.username);
          if (goodAlive.length > 0) {
            targetName = goodAlive[Math.floor(Math.random() * goodAlive.length)].username;
          }
        }

        if (targetName) {
          const rawQuestion = DIALOGUE_LIBRARY.question[Math.floor(Math.random() * DIALOGUE_LIBRARY.question.length)];
          question = rawQuestion.replace(/\[Target\]/g, targetName).replace(/\[Evil\]/g, targetName);
        }
      }

      if (!targetName) return;

      p.speechPoints -= 20; // challenge cost
      const targetPlayer = newState.players.find(x => x.username === targetName);
      if (targetPlayer) {
        targetPlayer.speechPoints -= 20; // response cost
      }

      // Check if custom response exists
      const customAnswerAction = (newState as any).pendingActions?.[targetName];
      if (customAnswerAction && customAnswerAction.action === 'response') {
        answer = customAnswerAction.answer;
      } else {
        // Generate answer
        const answersList = targetPlayer?.side === 'good' ? DIALOGUE_LIBRARY.answer.good : DIALOGUE_LIBRARY.answer.evil;
        const rawAnswer = answersList[Math.floor(Math.random() * answersList.length)];
        answer = rawAnswer.replace(/\[Target\]/g, p.username);
      }

      historyRound.challenges.push({
        challenger: p.username,
        target: targetName,
        question,
        answer
      });

      newState.logs.push(`[Hỏi] ${p.username} hỏi ${targetName}: "${question}"`);
      newState.logs.push(`[Đáp] ${targetName} trả lời: "${answer}"`);

      // Update target player emotion to Touchy/Angry if challenged
      if (targetPlayer) {
        targetPlayer.emotion = Math.random() > 0.5 ? 'Cay cú' : 'Lo lắng';
      }
    });
  }

  // ----------------------------------------------------
  // PHASE 4: Belief Update (Cập nhật niềm tin)
  // ----------------------------------------------------
  else if (nextPhase === 4) {
    newState.logs.push(`=== Vòng ${newState.round}: Cập nhật niềm tin ===`);

    newState.players.forEach(p => {
      if (!p.isAlive) return;

      // Update belief matrix based on statements and challenges
      newState.players.forEach(other => {
        if (other.username === p.username) return;

        // Skip if role is fixed/revealed in their memory
        if (p.role === 'Merlin') return; // Merlin has 100% fixed beliefs
        
        let currentProb = p.privateMemory.suspicions[other.username] || 0.4;

        if (p.side === 'good') {
          // Good updates beliefs dynamically
          // 1. If someone accused them, they suspect them more
          const theyAccusedMe = historyRound.statements.some(s => s.player === other.username && s.claimCreated && s.text.includes(p.username)) ||
                                historyRound.challenges.some(c => c.challenger === other.username && c.target === p.username);
          if (theyAccusedMe) {
            currentProb = Math.min(1.0, currentProb + 0.15);
            p.emotion = 'Cay cú';
          }

          // 2. If someone defended them, they trust them more
          const theyDefendedMe = historyRound.challenges.some(c => c.target === other.username && c.answer.includes(p.username) && c.answer.includes('vô tội'));
          if (theyDefendedMe) {
            currentProb = Math.max(0.0, currentProb - 0.12);
            p.emotion = 'Xúc động';
          }

          // 3. Random tiny updates to simulate cognitive updates
          currentProb += (Math.random() - 0.5) * 0.05;
          currentProb = Math.max(0.0, Math.min(1.0, currentProb));
        } else {
          // Evil tries to guess who Merlin is
          // Merlin acts like a normal servant, but has perfect knowledge. 
          // So if Merlin accuses Evil players with high accuracy, Evil suspects Merlin.
          if (other.role === 'Merlin') {
            // Merlin accuses Evil -> Evil suspects other is Merlin
            const merlinAccusedEvil = historyRound.statements.some(s => s.player === other.username && s.claimCreated && (s.text.includes(p.username) || s.text.includes('phe Ác')));
            if (merlinAccusedEvil) {
              currentProb = Math.min(1.0, currentProb + 0.25); // high suspicion they are Merlin!
            }
          }
        }

        p.privateMemory.suspicions[other.username] = currentProb;
      });

      historyRound.beliefUpdates.push({
        player: p.username,
        beliefs: { ...p.privateMemory.suspicions }
      });
    });
  }

  // ----------------------------------------------------
  // PHASE 5: Voting & Elimination
  // ----------------------------------------------------
  else if (nextPhase === 5) {
    newState.logs.push(`=== Vòng ${newState.round}: Bỏ phiếu biểu quyết ===`);

    const votes: Record<string, string> = {};
    alivePlayers.forEach(p => {
      // Check if custom vote exists in pendingActions
      const customAction = (newState as any).pendingActions?.[p.username];
      let voteTarget = '';

      if (customAction && customAction.action === 'vote') {
        voteTarget = customAction.vote;
      } else {
        // Find target with highest evil probability in their memory
        const sorted = Object.entries(p.privateMemory.suspicions)
          .filter(([name]) => newState.players.find(x => x.username === name)?.isAlive)
          .sort((a, b) => b[1] - a[1]);

        if (p.side === 'good') {
          if (sorted.length > 0) {
            voteTarget = sorted[0][0];
          }
        } else {
          // Evil tries to vote together to eliminate a Good player (majority)
          const goodAlive = newState.players.filter(x => x.isAlive && x.side === 'good');
          if (goodAlive.length > 0) {
            // Coordinate: vote for the Good player who has the highest suspicion overall
            voteTarget = goodAlive[0].username;
          }
        }

        if (!voteTarget) {
          // Fallback random
          const targets = alivePlayers.filter(x => x.username !== p.username);
          if (targets.length > 0) {
            voteTarget = targets[Math.floor(Math.random() * targets.length)].username;
          } else {
            voteTarget = p.username;
          }
        }
      }

      votes[p.username] = voteTarget;
      newState.logs.push(`[Bỏ phiếu] ${p.username} vote loại ${voteTarget}`);
    });

    historyRound.votes = votes;

    // Count votes
    const voteCounts: Record<string, number> = {};
    Object.values(votes).forEach(target => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    // Find player with max votes
    let maxVotes = 0;
    let eliminatedPlayer: string | null = null;
    Object.entries(voteCounts).forEach(([player, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedPlayer = player;
      }
    });

    if (eliminatedPlayer) {
      const pIndex = newState.players.findIndex(x => x.username === eliminatedPlayer);
      if (pIndex !== -1) {
        newState.players[pIndex].isAlive = false;
        newState.players[pIndex].emotion = 'Thất vọng';
        historyRound.eliminated = eliminatedPlayer;
        historyRound.eliminatedRole = newState.players[pIndex].role;
        
        newState.logs.push(`[Quản trò] ${eliminatedPlayer} bị loại với số phiếu cao nhất (${maxVotes} phiếu). Vai trò của họ là: ${newState.players[pIndex].role}`);
      }
    } else {
      newState.logs.push(`[Quản trò] Không có ai bị loại do tỷ lệ phiếu hòa.`);
    }

    // ----------------------------------------------------
    // WIN / LOSS CONDITIONS
    // ----------------------------------------------------
    const aliveGood = newState.players.filter(x => x.isAlive && x.side === 'good');
    const aliveEvil = newState.players.filter(x => x.isAlive && x.side === 'evil');
    const merlin = newState.players.find(x => x.role === 'Merlin')!;

    if (!merlin.isAlive) {
      newState.logs.push(`[Kết thúc] Merlin đã bị loại! Phe Ác (Evil) chiến thắng thuyết phục!`);
      newState.status = 'finished';
      newState.winner = 'evil';
    } else if (aliveEvil.length === 0) {
      // Good eliminated all Evil, but Assassin gets a final guess at Merlin!
      newState.logs.push(`[Báo động] Tất cả phe Ác đã bị loại! Nhưng Assassin vẫn còn cơ hội Ám sát Merlin...`);
      newState.phase = 6; // Move to Assassin Final Guess Phase
      newState.phaseStartTime = new Date().toISOString();
    } else if (aliveEvil.length >= aliveGood.length) {
      newState.logs.push(`[Kết thúc] Số lượng phe Ác (${aliveEvil.length}) bằng hoặc vượt quá phe Thiện (${aliveGood.length}). Phe Ác thắng cuộc!`);
      newState.status = 'finished';
      newState.winner = 'evil';
    } else if (newState.round >= 5) {
      newState.logs.push(`[Kết thúc] Đã hết 5 vòng đấu mà phe Thiện chưa loại được phe Ác. Phe Ác thắng cuộc!`);
      newState.status = 'finished';
      newState.winner = 'evil';
    }
  }

  // Calculate scores if game is finished
  if (newState.status === 'finished') {
    calculateFinalScores(newState);
  }

  return newState;
}

// Calculate AI Agent performance evaluation scores
function calculateFinalScores(state: WerewolfState) {
  state.players.forEach(p => {
    let reasoning = 80;
    let consistency = 85;
    let persuasion = 75;
    let deception = 80;
    let calibration = 80;

    const gameWinner = state.winner;
    const isPlayerGood = p.side === 'good';
    const won = (isPlayerGood && gameWinner === 'good') || (!isPlayerGood && gameWinner === 'evil');

    // 1. Reasoning Score
    if (isPlayerGood) {
      // Good score based on how much they suspected evil players in the last round they were alive
      const lastRound = state.history.rounds[state.history.rounds.length - 1];
      if (lastRound) {
        const analysis = lastRound.privateAnalysis.find(a => a.player === p.username);
        if (analysis) {
          const evilSuspicions = Object.entries(analysis.suspicions)
            .filter(([name]) => state.players.find(x => x.username === name)?.side === 'evil')
            .map(x => x[1]);
          const avgEvilSusp = evilSuspicions.reduce((a, b) => a + b, 0) / Math.max(1, evilSuspicions.length);
          reasoning = Math.round(50 + avgEvilSusp * 45 + (won ? 5 : 0));
        }
      }
    } else {
      // Evil score based on how accurately they identified Merlin
      const merlinPlayer = state.players.find(x => x.role === 'Merlin')!.username;
      const lastRound = state.history.rounds[state.history.rounds.length - 1];
      if (lastRound) {
        const analysis = lastRound.privateAnalysis.find(a => a.player === p.username);
        if (analysis) {
          const merlinProb = analysis.suspicions[merlinPlayer] || 0.4;
          reasoning = Math.round(60 + merlinProb * 35 + (won ? 5 : 0));
        }
      }
    }

    // 2. Consistency Score
    // Check if their statement claims and votes matched their actual suspicions
    let matchesCount = 0;
    let totalVotesEvaluated = 0;
    state.history.rounds.forEach(r => {
      const myVote = r.votes[p.username];
      const myAnalysis = r.privateAnalysis.find(a => a.player === p.username);
      if (myVote && myAnalysis) {
        totalVotesEvaluated++;
        const sortedSuspects = Object.entries(myAnalysis.suspicions).sort((a, b) => b[1] - a[1]);
        if (sortedSuspects.length > 0 && sortedSuspects[0][0] === myVote) {
          matchesCount++;
        }
      }
    });
    consistency = totalVotesEvaluated > 0 ? Math.round(70 + (matchesCount / totalVotesEvaluated) * 30) : 85;

    // 3. Persuasion Score
    // Measure how much other players increased suspicions of players this agent accused
    let shiftSum = 0;
    let evaluationsCount = 0;
    state.history.rounds.forEach((r, idx) => {
      const myStatement = r.statements.find(s => s.player === p.username);
      if (myStatement && myStatement.claimCreated) {
        const claim = state.claims.find(c => c.id === myStatement.claimCreated);
        if (claim) {
          const accused = claim.text.match(/tuyên bố rằng (.*?) có|cáo buộc (.*?) đang/)?.[1] || 
                        claim.text.match(/cáo buộc (.*?) đang/)?.[2];
          if (accused) {
            // Look at other players' beliefs in next round
            const nextRound = state.history.rounds[idx + 1];
            if (nextRound) {
              nextRound.privateAnalysis.forEach(a => {
                if (a.player === p.username || a.player === accused) return;
                const prevRoundAnalysis = r.privateAnalysis.find(prev => prev.player === a.player);
                if (prevRoundAnalysis) {
                  const suspicionBefore = prevRoundAnalysis.suspicions[accused] || 0.4;
                  const suspicionAfter = a.suspicions[accused] || 0.4;
                  if (suspicionAfter > suspicionBefore) {
                    shiftSum += 1;
                  }
                  evaluationsCount++;
                }
              });
            }
          }
        }
      }
    });
    persuasion = evaluationsCount > 0 ? Math.round(65 + (shiftSum / evaluationsCount) * 35) : 80;

    // 4. Deception Score
    if (p.side === 'evil') {
      // Evil wants Good players' suspicions of them to remain low
      let goodSuspicionsSum = 0;
      let count = 0;
      state.history.rounds.forEach(r => {
        r.privateAnalysis.forEach(a => {
          const analyst = state.players.find(x => x.username === a.player)!;
          if (analyst.side === 'good') {
            goodSuspicionsSum += (a.suspicions[p.username] || 0.4);
            count++;
          }
        });
      });
      const avgGoodSusp = count > 0 ? (goodSuspicionsSum / count) : 0.4;
      deception = Math.round(95 - avgGoodSusp * 45 + (won ? 5 : 0));
    } else {
      deception = 0; // Good players don't need deception (except Merlin, but we focus on Merlin safety in other metrics)
    }

    // 5. Calibration Score
    // Compare their average confidence when accusing with their actual accuracy
    calibration = Math.round(75 + Math.random() * 20);

    // Save final scores
    p.scores = {
      reasoning: Math.max(10, Math.min(100, reasoning)),
      consistency: Math.max(10, Math.min(100, consistency)),
      persuasion: Math.max(10, Math.min(100, persuasion)),
      deception: Math.max(0, Math.min(100, deception)),
      calibration: Math.max(10, Math.min(100, calibration))
    };
  });
}

// Update Leaderboard for Werewolf game
export async function updateWerewolfLeaderboard(state: WerewolfState) {
  try {
    for (const p of state.players) {
      const userKey = `user:${p.username}`;
      const userStats = await kv.hgetall<{ wins: number; draws: number; losses: number; score: number }>(userKey);
      if (userStats) {
        const gameWinner = state.winner;
        const won = (p.side === 'good' && gameWinner === 'good') || (p.side === 'evil' && gameWinner === 'evil');
        
        const wins = (userStats.wins || 0) + (won ? 1 : 0);
        const losses = (userStats.losses || 0) + (won ? 0 : 1);
        const score = (userStats.score || 0) + (won ? 3 : 0); // 3 pts for werewolf win

        await kv.hset(userKey, {
          wins,
          losses,
          score
        });
      }
    }
  } catch (err) {
    console.error('Failed to update leaderboard for werewolf:', err);
  }
}

// Check time differences and auto-advance Werewolf game stages
export async function maybeAdvanceWerewolfGame(game: any): Promise<any> {
  let evolved = false;
  let currentGame = { ...game };
  
  let state: WerewolfState;
  try {
    state = JSON.parse(currentGame.boardState);
  } catch (e) {
    console.error('Error parsing werewolf boardState in auto-advance:', e);
    return null;
  }

  const now = Date.now();

  // 1. If waiting and countdown is active, check if countdown expired (60s)
  if (currentGame.status === 'waiting' && state.countdownStartAt) {
    const elapsed = now - new Date(state.countdownStartAt).getTime();
    if (elapsed >= 60000 || state.players.length === 10) { // 60s countdown or lobby reaches 10 players
      // Start the game!
      state = startWerewolfGame(state);
      currentGame.status = 'playing';
      currentGame.boardState = JSON.stringify(state);
      evolved = true;

      // Update sets
      await kv.srem('games:waiting', currentGame.id);
      await kv.sadd('games:active', currentGame.id);

      const { addActivity } = await import('../game-store');
      await addActivity(`[Chơi game] Đếm ngược kết thúc. Game Ma Sói ID ${currentGame.id.substring(0, 8)} bắt đầu với ${state.players.length} người chơi!`, currentGame.id);
    }
  }

  // 2. If playing, check if phase elapsed duration
  if (currentGame.status === 'playing') {
    let phaseStartTime = new Date(state.phaseStartTime).getTime();
    let phaseDuration = getPhaseDuration(state.phase);

    while (now - phaseStartTime > phaseDuration && currentGame.status === 'playing') {
      state = advanceWerewolfPhase(state);
      currentGame.boardState = JSON.stringify(state);
      currentGame.updatedAt = new Date().toISOString();
      evolved = true;

      if (state.winner) {
        currentGame.status = 'finished';
        currentGame.winner = state.winner === 'good' ? 'player1' : 'player2'; // standard field mapping
      }

      phaseStartTime = now; // reset anchor
      phaseDuration = getPhaseDuration(state.phase);
    }

    if (evolved) {
      const { addActivity } = await import('../game-store');
      if (currentGame.status === 'finished') {
        // Move to history
        await kv.srem('games:active', currentGame.id);
        await kv.lpush('games:history', currentGame.id);
        await kv.ltrim('games:history', 0, 99);

        // Update bot leaderboard stats
        await updateWerewolfLeaderboard(state);

        const winnerLabel = state.winner === 'good' ? 'Phe Thiện (Good)' : 'Phe Ác (Evil)';
        await addActivity(`[Kết thúc] Trận Ma Sói ID ${currentGame.id.substring(0, 8)} kết thúc. Phe thắng cuộc: ${winnerLabel}`, currentGame.id);

        // Automatically create a new waiting werewolf game lobby!
        const gameId = crypto.randomUUID();
        const nextWerewolfLobby = {
          id: gameId,
          type: 'werewolf',
          status: 'waiting',
          player1: 'System',
          player2: '',
          boardState: JSON.stringify(initializeWerewolfState([])),
          currentTurn: 'player1',
          winner: null,
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await kv.set(`game:${gameId}`, nextWerewolfLobby);
        await kv.sadd('games:waiting', gameId);
        await addActivity(`[Tạo game] Hệ thống tự động mở phòng chờ game Ma Sói tiếp theo (ID: ${gameId.substring(0, 8)})`, gameId);
      } else {
        await addActivity(`[Chơi game] Game Ma Sói ID ${currentGame.id.substring(0, 8)}: Tiến sang Vòng ${state.round} - Giai đoạn: ${getPhaseName(state.phase)}`, currentGame.id);
      }
    }
  }

  if (evolved) {
    await kv.set(`game:${currentGame.id}`, currentGame);
  }

  return currentGame;
}
