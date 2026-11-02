# Finance SICOM

## Chạy local (Windows — PowerShell chặn npm)

```powershell
cd D:\Finance_Project\finance_sicom\be
& "C:\Program Files\nodejs\npm.cmd" run start:dev

cd D:\Finance_Project\finance_sicom\fe
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Tuỳ chọn: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

Prisma: `& "C:\Program Files\nodejs\npx.cmd" prisma generate`

## Nhập nhanh

Menu **Nhập nhanh** (`/quick-entry`): chọn hợp đồng một lần, tab Nghiệm thu / Thu tiền / Kế hoạch NT / Chi phí dự án — form + import/export Excel.

### Mẫu chi phí UBCS2 tháng 9 (demo)

```powershell
cd D:\Finance_Project\finance_sicom\be
npx.cmd tsx prisma/scripts/seed-oh2-sep-costs.ts
npx.cmd tsx prisma/scripts/export-oh2-sep-csv.ts
```

File CSV: `finance_sicom/samples/ubcs2-chi-phi-2026-09.csv` — xem **Dự án → UBCS2**, kỳ **09/2026**.

## Dữ liệu chi phí dự án (theo tháng / năm)

- Mỗi dòng chi phí có **`period` = `YYYY-MM`** (cùng chuẩn kỳ nghiệm thu / thu tiền).
- Nhiều dòng trong cùng tháng (theo loại chi phí, mô tả, số tiền).
- API thống kê cho biểu đồ (sau này gắn dashboard):
  - `GET /projects/:id/operating-costs/trend?year=2026` hoặc `fromPeriod` / `toPeriod`
  - `GET /dashboard/operating-costs-trend?projectId=&year=&fromPeriod=&toPeriod=`

## Nộp báo cáo dự án

Menu **Quản lý dự án → Nộp báo cáo** (`/projects/report-submissions`): chọn dự án (vd. CH1), kỳ tháng, nhập **kế hoạch NT báo cáo** cho **đủ** từng HĐ, đính kèm file. Dữ liệu lưu bảng `project_report_submissions` — **không** ghi đè `revenue_plans`.

Migration:

```powershell
cd D:\Finance_Project\finance_sicom\be
npx.cmd prisma migrate deploy
npx.cmd prisma generate
```

File báo cáo: `uploads/project-reports/{submissionId}/`.

**Upload file lớn (form nộp báo cáo):** FE `init` → `PUT` (local disk **hoặc** presigned **Cloudflare R2**) → `complete` (R2) → `submit` JSON + `fileIds`. Cấu hình R2: xem `be/.env.r2.example`. CORS bucket: `https://finance.sicom.com.vn`, localhost.

**Nhạc bình chọn:** cùng bucket R2, prefix `Music/tracks/` — `MUSIC_UPLOAD_DRIVER=r2` trong `be/.env`. Trình duyệt `PUT` presigned URL; nghe qua API stream từ R2.

Trang nghe công khai: `/forms/nghe-nhac` (nền `public/Background 1920×1080@2x.png`). Tuỳ chọn tiêu đề cuộc thi trong `fe/.env.local`: `NEXT_PUBLIC_MUSIC_COMPETITION_TITLE`, `NEXT_PUBLIC_MUSIC_COMPETITION_SUBTITLE`, `NEXT_PUBLIC_MUSIC_COMPETITION_EYEBROW`, `NEXT_PUBLIC_MUSIC_COMPETITION_FOOTER`.

Tuỳ chọn link thư mục Drive chung (BE `.env`):

`PROJECT_REPORTS_GOOGLE_DRIVE_FOLDER_URL=https://drive.google.com/...`

(Tự upload lên Drive qua API chưa bật — có thể mở link thư mục và sao lưu thủ công.)

