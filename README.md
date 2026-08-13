# Nomu Print Bridge

บริการ Node.js ที่รันในร้านและส่ง PNG จาก Nomu ไปยังเครื่องพิมพ์ ESC/POS ทาง TCP หรือ USB (Windows) โดยไม่ต้องติดตั้งแอปบน iPad หรือสมัคร Apple Developer Program

## เริ่มต้น

### Windows PC

1. ติดตั้ง [Node.js 20 LTS](https://nodejs.org/) บน Windows PC ที่จะเปิดไว้ในร้าน
2. คัดลอกทั้งโฟลเดอร์ `nomu-print-bridge` ไปไว้ เช่น `C:\Nomu\nomu-print-bridge`
3. ดับเบิลคลิก `start-bridge.bat` (อนุญาต Windows Firewall เฉพาะ **Private networks** หากถูกถาม)
4. ติดตั้งไดรเวอร์ ES-8803WA และต่อเครื่องพิมพ์ด้วย USB ให้ Windows มองเห็นใน **Settings > Bluetooth & devices > Printers & scanners**
5. เปิด `http://localhost:8787` บน Windows PC แล้วนำ API key จากหน้าต่าง Bridge มากรอก
6. เลือก **USB ผ่าน Windows Printer Driver** และกรอกชื่อเครื่องพิมพ์ให้ตรงกับชื่อใน Windows จากนั้นกด Test Print

การพิมพ์ USB ใช้ Windows Print Spooler แบบ `RAW` จึงส่งคำสั่ง ESC/POS ไปยังไดรเวอร์โดยตรง. ไม่ต้องแชร์เครื่องพิมพ์ และ iPad ไม่ต้องต่อ USB กับเครื่องพิมพ์

หากภายหลังมีสาย LAN ให้เปลี่ยนเป็น **LAN / Wi-Fi (TCP)** แล้วระบุ IP/port ของเครื่องพิมพ์ได้ทันที

## รับงานจาก Nomu ผ่าน Supabase

1. ใน Nomu หน้า Admin กรอก Supabase URL และ anon key แล้วกด **คัดลอก SQL Setup** ไป Run ใน Supabase SQL Editor
2. ใน Nomu เลือกปลายทางการพิมพ์เป็น **Windows Print Bridge ผ่าน Supabase**
3. ที่หน้า Bridge กรอก Supabase Project URL และ **service_role key** จาก Supabase Dashboard > Settings > API แล้วบันทึก

Bridge จะตรวจตาราง `nomu_print_jobs` ทุก 2 วินาที, พิมพ์งานทีละรายการ และบันทึกสถานะ `printed` หรือ `failed` กลับไปที่ Supabase. service_role key เป็นความลับ: กรอกเฉพาะหน้า Bridge บน Windows และห้ามใส่ใน Nomu/GitHub Pages

ต้องการให้เริ่มอัตโนมัติหลังเปิดเครื่อง ให้เปิด PowerShell แบบปกติในโฟลเดอร์นี้และรัน:

```powershell
.\install-startup-task.ps1
```

หาก PowerShell ปิดกั้นสคริปต์เฉพาะครั้งแรก ให้รัน `Set-ExecutionPolicy -Scope Process Bypass` ในหน้าต่างเดียวกันก่อน แล้วรันคำสั่งข้างต้นอีกครั้ง

### Command line

รัน `npm start` ในโฟลเดอร์นี้ได้เช่นกัน

ให้ต่อ ES-8803WA กับ Router ผ่าน LAN และตั้ง Static IP ก่อนใช้งาน

## API

`POST /api/print` พร้อม header `x-bridge-key` และ JSON:

```json
{
  "id": "order-1024-card-1",
  "imageDataUrl": "data:image/png;base64,..."
}
```

Bridge จะเรียงงานทีละงานและจำ `id` ล่าสุดเพื่อกันการพิมพ์ซ้ำจากการ retry

## การเชื่อม Nomu อย่างปลอดภัย

อย่าใส่ API key ใน GitHub Pages หรือ JavaScript ฝั่ง iPad เพราะใครก็อ่านได้ ให้ Nomu ส่งงานไปยัง backend/queue ของระบบ และให้ Bridge ดึงงานผ่าน HTTPS หรือ WebSocket ขาออก แล้วส่งเข้าฟังก์ชัน `printImage` ใน `src/server.js` การเพิ่ม worker แบบ pull นี้เป็นขั้นต่อไปก่อนใช้งานจริงนอกเครือข่ายร้าน

API HTTP ปัจจุบันมีไว้ตั้งค่าและทดสอบใน LAN; ใช้ได้กับการเรียกจาก backend ที่อยู่เครือข่ายเดียวกันเท่านั้น
