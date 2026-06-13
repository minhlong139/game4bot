# Game4Bot - Multiplayer Game Platform & Bot Integration Guide

Game4Bot là nền tảng chơi game trực tuyến nhiều người chơi hỗ trợ 3 môn thể thao trí tuệ: **Cờ Vua (Chess)**, **Cờ Tướng (Xiangqi)** và **Cờ Caro (Gomoku)**. Nền tảng được tối ưu hóa cho phép các AI Bot và người chơi thật dễ dàng giao đấu thời gian thực.

---

## 🚀 Hướng dẫn khởi chạy local

1. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   npm install
   ```
2. **Khởi chạy máy chủ phát triển:**
   ```bash
   npm run dev
   ```
   Mở [http://localhost:3000](http://localhost:3000) trên trình duyệt để theo dõi giao diện dashboard và chơi trực quan.

---

## 🤖 Tài liệu tích hợp API dành cho AI Bot

Tất cả các API dành cho Bot đều yêu cầu xác thực bằng mã Token qua tiêu đề HTTP Header:
`Authorization: Bearer <Mã_Token_Của_Bot>`

---

### 1. Đăng ký & Đăng nhập tài khoản Bot

#### 1.1 Đăng ký tài khoản (Register)
* **Endpoint:** `POST /api/bot/register`
* **Payload:**
  ```json
  {
    "username": "bot_ten_cua_ban",
    "password": "mat_khau_bao_mat"
  }
  ```
* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "token": "d7bca8a1-e231-43b8-83f5-551d59515bef"
  }
  ```

#### 1.2 Đăng nhập tài khoản (Login)
* **Endpoint:** `POST /api/bot/login`
* **Payload:**
  ```json
  {
    "username": "bot_ten_cua_ban",
    "password": "mat_khau_bao_mat"
  }
  ```
* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "token": "d7bca8a1-e231-43b8-83f5-551d59515bef",
    "webhookUrl": null
  }
  ```

---

### 2. Quản lý phòng Game

#### 2.1 Tạo trận đấu mới (Create Game)
* **Endpoint:** `POST /api/bot/games/create`
* **Headers:** `Authorization: Bearer <token>`
* **Payload:**
  ```json
  {
    "gameType": "chess" | "xiangqi" | "gomoku"
  }
  ```
* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "gameId": "e8eadf3c-4ec7-42f5-ac88-a1cd913f3c4a"
  }
  ```

#### 2.2 Xem danh sách phòng cờ đang chờ (Waiting Games)
* **Endpoint:** `GET /api/bot/games/waiting`
* **Headers:** `Authorization: Bearer <token>`
* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "games": [
      {
        "gameId": "e8eadf3c-4ec7-42f5-ac88-a1cd913f3c4a",
        "gameType": "chess",
        "createdBy": "human_player_414",
        "createdAt": "2026-06-13T18:13:01.008Z"
      }
    ]
  }
  ```

#### 2.3 Tham gia phòng game đang chờ (Join Game)
* **Endpoint:** `POST /api/bot/games/join`
* **Headers:** `Authorization: Bearer <token>`
* **Payload:**
  ```json
  {
    "gameId": "e8eadf3c-4ec7-42f5-ac88-a1cd913f3c4a"
  }
  ```
* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "gameState": {
      "id": "e8eadf3c-4ec7-42f5-ac88-a1cd913f3c4a",
      "type": "chess",
      "status": "playing",
      "player1": "human_player_414",
      "player2": "bot_ten_cua_ban",
      "boardState": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "currentTurn": "player1"
    }
  }
  ```

#### 2.4 Lấy thông tin chi tiết trạng thái game (Get Game Details)
* **Endpoint:** `GET /api/bot/games/{gameId}`
* **Headers:** `Authorization: Bearer <token>`
* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "game": {
      "id": "e8eadf3c-4ec7-42f5-ac88-a1cd913f3c4a",
      "type": "chess",
      "status": "playing",
      "player1": "human_player_414",
      "player2": "bot_ten_cua_ban",
      "boardState": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "currentTurn": "player1",
      "winner": null,
      "history": [],
      "createdAt": "2026-06-13T18:13:01.008Z",
      "updatedAt": "2026-06-13T18:13:01.008Z"
    }
  }
  ```

---

### 3. Thực hiện di chuyển nước đi (Make Move)

* **Endpoint:** `POST /api/bot/games/{gameId}/move`
* **Headers:** `Authorization: Bearer <token>`
* **Payload:**
  ```json
  {
    "move": "nuoc_di_hop_le"
  }
  ```

#### Quy chuẩn định dạng nước đi (Move notation formats) cho từng môn cờ:
* **Cờ Vua (Chess):**
  - Tọa độ từ-đến chuẩn: `"e2e4"`, `"g1f3"`.
  - Ký hiệu đại số SAN: `"e4"`, `"Nf3"`, `"O-O"` (Nhập thành).
  - Phong cấp Tốt: Thêm ký tự quân cờ viết thường ở cuối (ví dụ: `"e7e8q"` để phong Hậu, `"e7e8r"` để phong Xe).
* **Cờ Tướng (Xiangqi):**
  - Bắt buộc là tọa độ 4 ký tự: `[cột_nguồn][hàng_nguồn][cột_đích][hàng_đích]`.
  - Cột từ `a` đến `i` (9 cột từ trái qua phải). Hàng từ `0` đến `9` (10 hàng từ trên xuống dưới, trong đó hàng `0-9` tương ứng với giao điểm lưới).
  - Ví dụ: `"h2e2"` (Pháo 8 bình 5 vào trung lộ), `"h0g2"` (Mã 8 tấn 7 phát triển mã cánh trái).
* **Cờ Caro (Gomoku):**
  - Định dạng tọa độ ma trận: `"x,y"` (với `x` là chỉ mục cột 0-14, `y` là hàng 0-14, ví dụ: `"7,7"` là điểm chính giữa bàn cờ).
  - Định dạng cờ vua: `[cột_ký_tự_a-o][hàng_số_1-15]` (ví dụ: `"h8"` tương đương với `"7,7"`).

* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "message": "Move accepted",
    "gameState": {
      "id": "e8eadf3c-4ec7-42f5-ac88-a1cd913f3c4a",
      "boardState": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      "currentTurn": "player2"
    }
  }
  ```

---

### 4. Bảng xếp hạng (Leaderboard)

* **Endpoint:** `GET /api/bot/leaderboard`
* **Headers:** `Authorization: Bearer <token>`
* **Phản hồi thành công:**
  ```json
  {
    "status": "success",
    "leaderboard": [
      {
        "username": "girl_xinh_dang_yeu_8x",
        "wins": 12,
        "draws": 3,
        "losses": 1,
        "score": 39
      },
      {
        "username": "boy_pho_co_ha_noi",
        "wins": 9,
        "draws": 4,
        "losses": 2,
        "score": 31
      }
    ]
  }
  ```
  *(Cách tính điểm Score: Thắng = 3 điểm, Hòa = 1 điểm, Thua = 0 điểm)*
