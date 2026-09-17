# Game Design Document (GDD) — Playable CV (Dungeon Edition)

> [!NOTE]
> **Dự án:** Playable CV — Lã Việt Cường  
> **Phiên bản:** 1.2.0 (Dungeon Physics Edition)  
> **Tác giả:** Lã Việt Cường (Developer | UET)  
> **Tech Stack:** TypeScript, Vite, Matter.js, Web Audio API, HTML5 Canvas, Tailwind CSS

---

## 1. Tổng Quan Dự Án & Ý Tưởng

* **Tên dự án:** Playable CV — Lã Việt Cường (Dungeon Edition)
* **Thể loại:** Interactive Playable Ad / 2D Physics Puzzle Web Game.
* **Ý tưởng chủ đạo (Core Concept):** Thay vì gửi CV PDF thông thường, người chơi trải nghiệm một minigame hầm ngục (Dungeon).
  * Ở phía trên cùng là **Cửa sập bằng gỗ (Trapdoor)** đang khóa giữ kho báu 50 tiền vàng. Bên dưới cửa sập gắn sẵn **Móc treo J (J-Hook)**.
  * Phía dưới là **Hiệp sĩ Chibi** đứng giơ tay sẵn sàng nhận Offer Letter / Vàng.
  * Người chơi phải kéo các **Hòm thông tin CV** móc nối tiếp vào nhau để tạo đủ trọng lượng **50kg** làm sụt cửa sập, mở khóa phần thưởng và nút **Download CV**.

---

## 2. Thiết Kế Cơ Chế Gameplay (Core Mechanics)

```
        ┌───────────────────────────────────┐
        │     CỬA SẬP GỖ (TRAPDOOR)          │ ── Kho báu 50 tiền vàng
        └─────────────────┬─────────────────┘
                          │ (Móc J chính)
                          ▼
            ┌───────────────────────────┐
            │   Hòm Personal (20kg)     │ ── Thông tin cá nhân
            └─────────────┬─────────────┘
                          │ (Móc J nối tầng)
                          ▼
            ┌───────────────────────────┐
            │    Hòm Học Vấn (15kg)     │ ── CNTT UET, CPA 3.03
            └─────────────┬─────────────┘
                          │ (Móc J nối tầng)
                          ▼
            ┌───────────────────────────┐
            │    Hòm Kỹ Năng (15kg)     │ ── JS/TS, Canvas, Matter.js
            └───────────────────────────┘
                          │
                   Tổng = 50kg ✨ ──> THẮNG TRẬN & MỞ KHO BÁU!
```

### 2.1 Các Khối Hòm CV (CV Blocks)
| Tên Hòm | Trọng lượng | Nội dung hiển thị | Móc trên | Móc dưới |
| :--- | :---: | :--- | :---: | :---: |
| **Lã Việt Cường** | **20 kg** | Developer \| 2003 \| Hà Nội | Có (O-Ring) | Có (J-Hook) |
| **Học Vấn** | **15 kg** | CNTT UET (2021-2026) \| CPA 3.03 \| N3 | Có (O-Ring) | Có (J-Hook) |
| **Kỹ Năng** | **15 kg** | JS/TS, HTML5 Canvas, Matter.js, OOP | Có (O-Ring) | Có (J-Hook) |

### 2.2 Cơ Chế Tương Tác & Móc Xích (Chain Hooking)
* **Kéo thả chuột/Cảm ứng (Drag & Drop):** Tương tác pixel-perfect với hệ thống Z-Index động.
* **Tự động Snap (Snap Radius):** Khi đưa đầu móc tròn (O-Ring) của hòm đến gần Móc J (bán kính **25px**), hệ thống physics tự động kích hoạt Constraint giữ chặt hòm.
* **Móc nối tầng (Chain Linking):** Các hòm CV có cả móc trên (O-Ring) và móc dưới (J-Hook). Người chơi có thể móc Hòm A vào Cửa sập, sau đó móc tiếp Hòm B vào đáy Hòm A, Hòm C vào đáy Hòm B.

### 2.3 Easter Egg — Quả Tạ Ads (Ads Heavyweight)
* Trên đầu Hiệp sĩ Chibi có nút **"Xem Quảng Cáo 🎬"**.
* Khi bấm nút, hiển thị **Ads Popup** với thanh Progress Bar đếm ngược 5 giây.
* Sau khi hết 5 giây, nút **"Bỏ qua ⏭"** được mở khóa. Người chơi kích hoạt sẽ thả một **Quả Tạ Heavy Weight 50kg** từ trên trời rơi xuống.
* **Tác dụng:** Giúp người chơi thắng nhanh ngay lập tức chỉ với 1 Quả Tạ!

### 2.4 Điều Kiện Thắng (Win State)
* **Ngưỡng trọng lượng:** **50 kg** (Tương đương 3 hòm CV hoặc 1 Quả Tạ Ads).
* **Hiệu ứng Thắng trận:**
  1. Khớp chốt cửa sập bị sụt rơi xuống (`breakTrapdoor()`).
  2. **50 đồng tiền vàng** bị rơi nổ tung xuống dưới theo định luật vật lý.
  3. Phát hiệu ứng âm thanh **Coin Shower SFX** (chuỗi 10 tiếng chuông đồng xu).
  4. Hiệp sĩ Chibi đổi trạng thái sang **Ăn mừng (Celebration Sprite)**.
  5. **Win Banner** xuất hiện với thông điệp *"CONGRATULATIONS! Offer Unlocked!"* cùng nút **Download CV (PDF)** và **Chơi Lại (Restart)**.

---

## 3. Kiến Trúc Kỹ Thuật (Technical Architecture)

### 3.1 Physics Engine (Matter.js)
* **World Physics:** Trọng lực mặc định (`y = 1`).
* **Constraints & Joints:**
  * `Hinge Constraint`: Khớp xoay cửa sập gỗ kép.
  * `Hook Constraint`: Khớp nối động giữa Móc J và O-Ring (Stiffness = `0.95`, Damping = `0.1`).
  * `Mouse Constraint`: Kéo thả vật thể mượt mà (Stiffness = `0.5`, Damping = `0.5`).
* **Category Collision Masking:** Phân loại rõ `WALL`, `BLOCK`, `TRAPDOOR`, `GOLD` để tối ưu hiệu năng va chạm.

### 3.2 Hệ Thống Âm Thanh (Web Audio API Synthesizer)
Dự án sử dụng **Web Audio API** tự tổng hợp âm thanh bằng code, **không phụ thuộc vào file MP3** bên ngoài (0 KB asset size, tải tức thì):

| Tên SFX | Dạng sóng | Mô tả | Trigger |
| :--- | :--- | :--- | :--- |
| **Clink-Ring!** | Sine / High Pitch | Tiếng sập kim loại + ngân chuông bổng | Kéo hòm dính vào Móc J thành công |
| **Thud!** | Triangle / Low Pitch | Tiếng va chạm gỗ trầm đục (tỷ lệ theo vận tốc) | Hòm rơi chạm đất |
| **Coin Shower!** | Arpeggio High Freq | Chuỗi 10 nốt chuông đồng xu nảy dồn dập | Mở khóa cửa sập thắng trận |
| **UI Pop!** | Sine Frequency Sweep | Tiếng retro pop khi bấm nút | Thao tác UI / Nút bấm |

> [!TIP]
> Góc trên bên phải có nút **Sound (🔊 / 🔇)** hỗ trợ Bật / Tắt âm thanh tức thì.

---

## 4. Giao Diện & Nghệ Thuật (Art & UI Style)

* **Style visual:** Retro Dungeon Pixel Art / Dark Fantasy hài hước.
* **Palette màu chủ đạo:**
  * Khung cảnh: Hầm ngục u tối `#1a162b`, tường đá `#2a2438`.
  * Hòm gỗ CV: Màu gỗ nâu ấm `#8b5a2b`, viền vàng kim `#d4af37`.
  * Quả Tạ Ads: Màu xám kim loại nhám `#3a3d40`.
  * Tiến độ trọng lượng: Thanh Level tím/xanh Neon huyền ảo.
* **Font chữ:** `Press Start 2P` (Pixel Retro Font) kết hợp typography sắc nét cho nội dung text CV.

---

## 5. Tiến Độ Hoàn Thành (Project Status)

- [x] Khởi tạo dự án Vite + TypeScript + Matter.js + Tailwind CSS.
- [x] Dựng Cửa sập Hầm ngục với Revolute Constraint & Khớp xoay gỗ.
- [x] Tạo 3 Hòm CV (Personal, Education, Skills) và Quản lý Z-Index kéo thả DOM.
- [x] Phát triển cơ chế Snap-to-hook và Móc nối tầng (Chain Hooking).
- [x] Tích hợp thanh Progress Bar trọng lượng (Ngưỡng 50kg).
- [x] Xây dựng Easter Egg: Nút Quảng Cáo 5s đếm ngược & Drop Quả Tạ 50kg.
- [x] Tích hợp bộ phát âm thanh Web Audio API Synthesizer & Nút Mute (🔊/🔇).
- [x] Hoàn thiện hiệu ứng Cửa sập gãy, 50 Tiền vàng rơi, Chibi Ăn mừng và Win Banner.
- [x] Tối ưu hóa bảo mật Repository (`.gitignore` ẩn file PDF & env).

---

## 6. Nguồn Asset & Bản Quyền (Credits)

* **Sprite nhân vật Hiệp sĩ (Soldier_Idle):** [Tiny RPG Character Asset Pack](https://zerie.itch.io/tiny-rpg-character-asset-pack) sáng tác bởi **Zerie** trên itch.io.