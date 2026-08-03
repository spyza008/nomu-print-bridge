# Nomu Print Bridge

บริการ Node.js ที่รันในร้านและส่ง PNG จาก Nomu ไปยังเครื่องพิมพ์ ESC/POS ทาง TCP (ES-8803WA ปกติใช้ `9100`) โดยไม่ต้องติดตั้งแอปบน iPad หรือสมัคร Apple Developer Program

## เริ่มต้น

### Windows PC

1. ติดตั้ง [Node.js 20 LTS](https://nodejs.org/) บน Windows PC ที่จะเปิดไว้ในร้าน
2. คัดลอกทั้งโฟลเดอร์ `nomu-print-bridge` ไปไว้ เช่น `C:\Nomu\nomu-print-bridge`
3. ดับเบิลคลิก `start-bridge.bat` (อนุญาต Windows Firewall เฉพาะ **Private networks** หากถูกถาม)
4. เปิด `http://localhost:8787` บน Windows PC แล้วนำ API key จากหน้าต่าง Bridge มากรอก
5. ตั้ง IP เครื่องพิมพ์และกด Test Print

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
