# XMoni - Quản lý chi tiêu cá nhân

Ứng dụng web quản lý chi tiêu cá nhân, chạy trên GitHub Pages, lưu dữ liệu trên Google Drive.

## ✨ Tính năng

- 🔐 Đăng nhập bằng Google (mỗi người dữ liệu riêng)
- 📂 Dữ liệu lưu an toàn trên Google Drive cá nhân
- 💰 Tạo danh mục chi tiêu (ăn uống, shopping, v.v.)
- 📅 Đặt budget theo tháng (có thể đặt trước tháng sau)
- ⚡ Nhập chi tiêu nhanh bằng numpad
- 📊 Dashboard: xem mỗi ngày được xài bao nhiêu
- 🔄 Tự động chuyển dư/nợ sang tháng sau

## 🚀 Cách deploy

### 1. Tạo Google Cloud Project

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. **Tạo Project mới** → đặt tên "XMoni"
3. Vào **APIs & Services → Library** → bật **Google Drive API**
4. Vào **APIs & Services → OAuth consent screen**:
   - Chọn **External** → Create
   - Điền App name: "XMoni", email
   - Tab **Scopes** → Add: `https://www.googleapis.com/auth/drive.file`
   - Tab **Test users** → thêm email Google của bạn
5. Vào **Credentials** → **Create Credentials → OAuth client ID**:
   - Type: **Web application**
   - Authorized JavaScript origins: `https://<username>.github.io`
   - Authorized redirect URIs: `https://<username>.github.io/xmoni/`
6. Copy **Client ID**

### 2. Cấu hình

Mở file `js/auth.js`, thay `YOUR_CLIENT_ID_HERE` bằng Client ID vừa copy:

```javascript
CLIENT_ID: 'xxxx.apps.googleusercontent.com',
```

### 3. Deploy lên GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<username>/xmoni.git
git push -u origin main
```

Vào **Settings → Pages → Source: main branch** → Save.

Truy cập: `https://<username>.github.io/xmoni/`

## 📱 Sử dụng

1. Mở app → Đăng nhập bằng Google
2. Vào tab **Budget** → Tạo danh mục (Tiền ăn, Shopping...)
3. Đặt budget cho tháng hiện tại
4. Nhấn nút **+** để nhập chi tiêu nhanh
5. Xem **Dashboard** để biết mỗi ngày còn được xài bao nhiêu

## 🔒 Bảo mật

- Dữ liệu chỉ lưu trên Google Drive cá nhân của bạn
- App không có server backend → không ai truy cập được dữ liệu của bạn
- Token chỉ lưu trong session, đóng tab = hết phiên
