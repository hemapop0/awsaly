// =====================================
// أوصلي - WhatsApp Report System
// Frontend فقط: رفع الصور على Cloudinary + إرسال اللينكات على واتساب
// =====================================

// رقم الواتساب اللي هيستقبل البلاغات (صيغة دولية بدون +)
const phoneNumber = "201150421959";

// إعدادات Cloudinary
const CLOUD_NAME = "fi1tfnpe";
const UPLOAD_PRESET = "awsally_upload";

// حدود الصور
const MAX_IMAGES = 8;          // أقصى عدد صور (علشان طول رابط واتساب)
const MAX_DIMENSION = 1600;    // أقصى عرض/طول للصورة بالبكسل بعد الضغط
const JPEG_QUALITY = 0.8;      // جودة الضغط

// بيانات السيارة
const carModel = "Chevrolet Cruze";
const plateNumber = "وه - ٥٧٩٤";

// عناصر HTML
const description = document.getElementById("description");
const sendWhatsApp = document.getElementById("sendWhatsApp");
const imagesInput = document.getElementById("images");
const imagePreview = document.getElementById("imagePreview");

const defaultButtonText = sendWhatsApp.textContent.trim();


// =====================================
// معاينة الصور المختارة
// =====================================

// الصور المختارة (بتتجمع مع كل اختيار جديد بدل ما تتبدل)
let selectedFiles = [];
let previewUrls = [];

function renderPreview() {

    // تنضيف الروابط المؤقتة القديمة
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];

    imagePreview.innerHTML = "";

    selectedFiles.forEach(function (file, index) {

        const url = URL.createObjectURL(file);
        previewUrls.push(url);

        const item = document.createElement("div");
        item.className = "preview-item";

        const img = document.createElement("img");
        img.src = url;
        img.alt = "صورة المشكلة";

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-image";
        removeBtn.textContent = "✕";
        removeBtn.setAttribute("aria-label", "حذف الصورة");

        removeBtn.addEventListener("click", function () {
            selectedFiles.splice(index, 1);
            renderPreview();
        });

        item.appendChild(img);
        item.appendChild(removeBtn);
        imagePreview.appendChild(item);

    });

}

imagesInput.addEventListener("change", function () {

    const newFiles = Array.from(imagesInput.files);

    // نفضّي الـ input علشان نقدر نختار نفس الصورة تاني لو اتمسحت
    imagesInput.value = "";

    const freeSlots = MAX_IMAGES - selectedFiles.length;

    if (newFiles.length > freeSlots) {
        alert(`أقصى عدد للصور هو ${MAX_IMAGES}. تم إضافة ${Math.max(freeSlots, 0)} فقط.`);
    }

    selectedFiles = selectedFiles.concat(newFiles.slice(0, Math.max(freeSlots, 0)));

    renderPreview();

});


// =====================================
// ضغط الصورة قبل الرفع
// =====================================

function compressImage(file) {

    return new Promise(function (resolve) {

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function () {

            URL.revokeObjectURL(url);

            let { width, height } = img;
            const ratio = Math.min(1, MAX_DIMENSION / Math.max(width, height));

            width = Math.round(width * ratio);
            height = Math.round(height * ratio);

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                function (blob) {
                    // لو الضغط فشل لأي سبب، نرفع الصورة الأصلية
                    resolve(blob || file);
                },
                "image/jpeg",
                JPEG_QUALITY
            );

        };

        // لو المتصفح مش قادر يقرا الصورة (زي HEIC)، نرفع الأصلية
        img.onerror = function () {
            URL.revokeObjectURL(url);
            resolve(file);
        };

        img.src = url;

    });

}


// =====================================
// رفع صورة واحدة على Cloudinary
// =====================================

async function uploadImage(file) {

    const blob = await compressImage(file);

    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    if (!response.ok) {
        throw new Error("Upload failed: " + response.status);
    }

    const data = await response.json();
    return data.secure_url;

}


// =====================================
// إرسال البلاغ
// =====================================

sendWhatsApp.addEventListener("click", async function () {

    // المشكلة المختارة
    const selectedProblem = document.querySelector(
        'input[name="problem"]:checked'
    );

    // تفاصيل المشكلة
    const problemDescription = description.value.trim() || "لا توجد تفاصيل";

    // الصور المختارة
    const selectedImages = selectedFiles.slice(0, MAX_IMAGES);

    // التحقق من رقم الواتساب
    if (!/^20\d{10}$/.test(phoneNumber)) {
        alert("رقم الواتساب في ملف JavaScript غير صحيح");
        return;
    }

    // التحقق من اختيار المشكلة
    if (!selectedProblem) {
        alert("من فضلك اختار نوع المشكلة");
        return;
    }

    // منع الضغط المتكرر
    sendWhatsApp.disabled = true;

    // =====================================
    // رفع الصور
    // =====================================

    let imageLinks = [];

    if (selectedImages.length > 0) {

        sendWhatsApp.textContent = "⏳ جاري رفع الصور...";

        try {

            imageLinks = await Promise.all(
                selectedImages.map(uploadImage)
            );

        } catch (error) {

            console.error(error);

            sendWhatsApp.disabled = false;
            sendWhatsApp.textContent = defaultButtonText;

            alert(
                "حصلت مشكلة أثناء رفع الصور. اتأكد من النت وجرب تاني."
            );

            return;

        }

    }

    // =====================================
    // تجهيز رسالة البلاغ
    // =====================================

    const imagesSection = imageLinks.length > 0
        ? imageLinks.map((link, i) => `صورة ${i + 1}: ${link}`).join("\n")
        : "لا توجد صور";

    const message = `
🚗 بلاغ جديد من موقع أوصلي

السلام عليكم، حبيت أبلغك إن في مشكلة متعلقة بعربيتك.

━━━━━━━━━━━━━━

🚘 بيانات السيارة:

نوع السيارة: ${carModel}
رقم اللوحة: ${plateNumber}

━━━━━━━━━━━━━━

⚠️ نوع المشكلة:

${selectedProblem.value}

━━━━━━━━━━━━━━

📝 تفاصيل المشكلة:

${problemDescription}

━━━━━━━━━━━━━━

📷 صور المشكلة:

${imagesSection}

━━━━━━━━━━━━━━

برجاء مراجعة المشكلة والتواصل معي.

تم إرسال البلاغ من موقع أوصلي 🚗
`;

    // =====================================
    // فتح واتساب برقمك
    // =====================================

    const whatsappURL =
        `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    sendWhatsApp.textContent = "✅ جاري فتح واتساب...";

    // location.href بدل window.open علشان الموبايل مبيحجبهاش بعد عملية الرفع
    window.location.href = whatsappURL;

    // رجّع الزرار لو المستخدم رجع للصفحة
    setTimeout(function () {
        sendWhatsApp.disabled = false;
        sendWhatsApp.textContent = defaultButtonText;
    }, 3000);

});