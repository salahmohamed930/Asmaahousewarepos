# دليل تأمين وتشغيل نظام الطباعة المباشرة QZ Tray
## Asmaa Houseware POS - Production QZ Tray Security Guide

يقدم هذا الدليل التوثيق الكامل لإعداد وتأمين نظام الطباعة المباشرة الصامتة (Direct Silent Printing) عبر برمجية **QZ Tray** في مشروع نقطة بيع **أسماء للأدوات المنزلية (Asmaa Houseware POS)** وفقًا لأعلى معايير الأمان المؤسسي (Enterprise Security).

---

## 1. الهيكلية الأمنية (Architecture Overview)

```
+-------------------------------------------------------------+
|                     متصفح الويب (Browser)                   |
|  - واجهة الكاشير / الإعدادات                               |
|  - qzPrinterService (بدون أي مفاتيح خاصة إطلاقاً!)          |
+--------------------+-------------------+--------------------+
                     |                   |
 (1) طلب الشهادة     |                   | (3) إرسال أمر الطباعة
     والتوقيع الرقمي |                   |     مع التوقيع الرقمي
                     v                   v
+--------------------+---+       +-------+--------------------+
|  الخادم الآمن (Backend) |       |  برنامج QZ Tray على الويندوز|
|  - Express / Vercel    |       |  - WebSocket (localhost)   |
|  - QZ_PRIVATE_KEY (RSA)|       |  - يتحقق من الشهادة العامة |
|  - RSA-SHA512 Signing  |       |  - يطابق التوقيع الرقمي     |
|  - فحص النطاق (CORS)   |       +-------+--------------------+
+------------------------+               |
                                         | (4) طباعة صامتة فورية
                                         v
                                 +-------+--------------------+
                                 | طابعة الفواتير / الباركود   |
                                 +----------------------------+
```

### المبادئ الأمنية الصارمة:
1. **انعدام المفتاح الخاص من الواجهة الأمامية (Zero Frontend Secret Exposure):**
   - لا يتم تضمين `QZ_PRIVATE_KEY` داخل كود الواجهة أو حزمة JavaScript أو `localStorage` أو أي متغير يبدأ بـ `VITE_`.
2. **التوقيع بخوارزمية متقدمة (RSA with SHA-512):**
   - يتم توقيع طلبات الطباعة رقمياً بخوارزمية SHA-512 على السيرفر فقط.
3. **تقييد النطاقات المصرح بها (Origin Authorization):**
   - يرفض الخادم توقيع أي طلبات قادمة من نطاقات غير مضافة في `QZ_ALLOWED_ORIGINS`.

---

## 2. توليد الشهادة الرقمية والمفتاح الخاص (OpenSSL Commands)

لتشغيل النظام في بيئة الإنتاج برخصة أو بشهادة رقمية معتمدة:

### الخطوة 1: توليد المفتاح الخاص (Private Key - RSA 2048-bit)
```bash
openssl genrsa -out qz-private-key.pem 2048
```

### الخطوة 2: تحويل المفتاح إلى صيغة PKCS#8 القياسية (موصى به للتوافقية العالية)
```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in qz-private-key.pem -out qz-private-key-pkcs8.pem
```

### الخطوة 3: توليد شهادة رقمية عامة موثقة ذاتياً (Public X.509 Certificate) صالحة لمدة سنتين
```bash
openssl req -new -x509 -key qz-private-key-pkcs8.pem -out qz-certificate.pem -days 730 -subj "/CN=Asmaa Houseware POS/O=Asmaa Houseware/C=EG"
```

ستحصل على ملفين أساسيين:
1. `qz-certificate.pem`: الشهادة العامة (Public Certificate) - يمكن نشرها أو تمريرها للـ Frontend عبر الـ Endpoint.
2. `qz-private-key-pkcs8.pem`: المفتاح الخاص (Private Key) - **سرّي للغاية** يوضع فقط في متغيرات بيئة الخادم.

---

## 3. تثبيت واعتماد الشهادة في QZ Tray على أجهزة الكاشير (Windows)

### الطريقة الأولى: الاعتماد التلقائي بنقرة واحدة (موصى بها وسهلة جداً)
1. افتح برنامج **QZ Tray** على جهاز الكاشير.
2. افتح شاشة إعدادات النظام في المتصفح واضغط **"فحص الأمان والاتصال"**.
3. ستظهر نافذة منبثقة من برنامج QZ Tray تحتوي على اسم الشهادة `Asmaa Houseware POS`.
4. حدد خيار **"Remember this decision"** (تذكر هذا القرار دائماً).
5. اضغط على زر **"Allow"** أو **"Trust"**.
6. لن تظهر هذه النافذة مرة أخرى، وسيتم قبول أي أمر طباعة تلقائياً وبشكل صامت بدون أي نوافذ!

### الطريقة الثانية: التثبيت اليدوي الدائم (Manual Override)
إذا أردت تثبيت الشهادة مسبقاً قبل فتح المتصفح:
1. انسخ محتوى ملف `qz-certificate.pem` واجعله باسم `override.crt`.
2. انسخ الملف إلى مسار بيانات QZ Tray على الويندوز:
   `%APPDATA%\qz\override.crt` (مثال: `C:\Users\<اسم_المستخدم>\AppData\Roaming\qz\override.crt`).
3. أعد تشغيل برنامج QZ Tray من شريط المهام.

---

## 4. إعداد متغيرات البيئة (Environment Variables)

| اسم المتغير | الوصف | مثال للقيمة | مكان الإعداد |
| :--- | :--- | :--- | :--- |
| `QZ_PRIVATE_KEY` | المفتاح الخاص السري لتوقيع طلبات الطباعة (RSA-SHA512) | `-----BEGIN PRIVATE KEY-----\nMIIEv...-----END PRIVATE KEY-----` | **Server / Cloud Secrets فقط** |
| `QZ_CERTIFICATE` | الشهادة العامة بصيغة PEM | `-----BEGIN CERTIFICATE-----\nMIID...-----END CERTIFICATE-----` | Server Secrets |
| `QZ_ALLOWED_ORIGINS` | قائمة النطاقات المسموح لها بطلب التوقيع (مفصولة بفواصل) | `https://asmaa-pos.vercel.app,http://localhost:3000` | Server Secrets |

> **تنبيه هام حول الأسطر المتعددة (Multi-line PEM):**
> عند لصق المفاتيح في لوحات التحكم مثل Vercel أو Supabase، يمكنك لصق النص كاملاً بأمطاره، أو استبدال نهايات الأسطر برمز `\n`، فنظامنا يتعرف تلقائياً على كلا التنسيقين ويعالجهما بأمان.

### أ. الإعداد على Vercel:
1. اذهب إلى لوحة تحكم مشروعك على Vercel > **Settings** > **Environment Variables**.
2. أضف `QZ_PRIVATE_KEY` وضع محتوى `qz-private-key-pkcs8.pem`.
3. أضف `QZ_CERTIFICATE` وضع محتوى `qz-certificate.pem`.
4. أضف `QZ_ALLOWED_ORIGINS` وضع رابط دومين موقعك على Vercel ورابط الدومين المخصص إن وجد.
5. أعد عمل **Redeploy** لتفعيل المتغيرات.

### ب. الإعداد على خادم Node.js / Docker / Cloud Run:
أضف المتغيرات إلى ملف `.env` في الخادم:
```env
PORT=3000
NODE_ENV=production
QZ_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
QZ_CERTIFICATE="-----BEGIN CERTIFICATE-----\nMIIDdTCCAl2gAwIBAgIU...\n-----END CERTIFICATE-----"
QZ_ALLOWED_ORIGINS="https://pos.asmaa-store.com,http://localhost:3000"
```

### ج. الإعداد مع Supabase Edge Functions:
تم توفير دالة Edge Function جاهزة داخل المسار `supabase/functions/qz-sign/index.ts`. لنشرها وتعيين الأسرار:
```bash
# ضبط الأسرار
supabase secrets set QZ_PRIVATE_KEY="$(cat qz-private-key-pkcs8.pem)"
supabase secrets set QZ_ALLOWED_ORIGINS="https://pos.asmaa-store.com"

# نشر الدالة
supabase functions deploy qz-sign
```

---

## 5. واجهات الـ API ونقاط النهاية (API Endpoints)

| المسار | الطريقة | الوظيفة | الأمان والحماية |
| :--- | :--- | :--- | :--- |
| `/api/qz/certificate` | `GET` | إرجاع الشهادة العامة لـ QZ Tray | متاح مع تدقيق CORS |
| `/api/qz/sign` | `POST` | توقيع حمولة طلب الطباعة باستخدام خوارزمية SHA-512 | محمي بفحص النطاق Origin + حد أقصى للحجم (500KB) |
| `/api/qz/status` | `GET` | فحص تشخيصي لحالة التهيأة وتوفر المفاتيح | لا يكشف المفتاح الخاص إطلاقاً |

---

## 6. فحص وتشخيص الأعطال (Troubleshooting Matrix)

| المشكلة / رسالة الخطأ | السبب المحتمل | الحل السريع |
| :--- | :--- | :--- |
| **برنامج QZ Tray غير مشغل أو غير مثبت** (`Connection refused`) | برنامج QZ Tray ليس قيد التشغيل في شريط المهام بالويندوز. | افتح برنامج QZ Tray من قائمة Start وتأكد من ظهور أيقونة الجسر الأخضر بجوار الساعة. |
| **تم رفض الاتصال الأمني: Origin Not Allowed** (`403 Forbidden`) | النطاق الذي تفتح منه الموقع غير مضاف في `QZ_ALLOWED_ORIGINS`. | أضف رابط الموقع (مثلاً `https://your-domain.com`) إلى متغير `QZ_ALLOWED_ORIGINS` على الخادم. |
| **خدمة التوقيع الرقمي غير متاحة** (`503 Unavailable`) | متغير البيئة `QZ_PRIVATE_KEY` مفقود أو فارغ على السيرفر في بيئة Production. | أضف المفتاح الخاص في إعدادات البيئة على Vercel أو الخادم. |
| **تم رفض الشهادة الرقمية** (`Untrusted Certificate`) | الشهادة منتهية أو لم يتم الضغط على "Allow / Trust" في نافذة QZ Tray. | افتح QZ Tray > Site Manager وتأكد من إضافة النطاق كـ Allowed، أو اضغط "فحص الأمان والاتصال" واختر Trust. |
| **تم رفض التوقيع الرقمي** (`Signature Rejected`) | المفتاح الخاص `QZ_PRIVATE_KEY` لا يتطابق مع الشهادة `QZ_CERTIFICATE`. | تأكد أن المفتاح والشهادة تم توليدهما كزوج متطابق في OpenSSL. |
| **الطابعة غير موجودة في نظام Windows** | تم كتابة اسم الطابعة خطأ أو تم تغيير اسمها في لوحة تحكم الويندوز. | اضغط زر **"اكتشاف الطابعات المتاحة"** في إعدادات البرنامج واختر الطابعة من القائمة المكتشفة تلقائياً. |
| **الطابعة غير متصلة (Offline)** | كابل الـ USB مفصول أو الطابعة مغلقة أو نفد رول الورق. | تأكد من إضاءة الطابعة بلون أخضر ثابت والتأكد من تغذية الورق الحراري بشكل صحيح. |

---

## 7. آلية التوجيه التلقائي للطوارئ (Fallback Protection)

- إذا كان برنامج **QZ Tray متصلاً وموقعاً بنجاح**: تتم الطباعة الصامتة فوراً على الطابعة المحددة بدون ظهور أي نوافذ على الشاشة إطلاقاً.
- إذا كان برنامج **QZ Tray غير متصل أو واجه عطلاً طارئاً**: يقوم النظام فوراً وبشكل تلقائي بفتح نافذة طباعة الويندوز المعتادة (`window.print`) مع إشعار الكاشير بسبب المشكلة، حتى لا تتوقف حركة البيع وتسليم الفواتير للعملاء نهائياً.
