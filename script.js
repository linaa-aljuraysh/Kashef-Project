// 1. إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBzYFYYavMnPsWTmyN5BURsiw3PiWFRYgc",
    authDomain: "kashef-387b5.firebaseapp.com",
    projectId: "kashef-387b5",
    storageBucket: "kashef-387b5.firebasestorage.app",
    messagingSenderId: "562274891980",
    appId: "1:562274891980:web:87cf6ce147c0fe6785aa69",
    measurementId: "G-YS9Y0SB51G"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// --- وظائف التحقق (Validation) ---
function validateInputs(email, password) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert("Please enter a valid email address.");
        return false;
    }
    if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return false;
    }
    return true;
}

// --- التنقل بين الصفحات ---
function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(id + "-page");
    if (target) {
        target.classList.add("active");
        window.scrollTo(0, 0);
    }
}

function checkAuthStatus() {
    if (currentUser) {
        showPage('dashboard');
    } else {
        showPage('login');
    }
}

// --- مراقبة حالة تسجيل الدخول (حل مشكلة الاسم) ---
auth.onAuthStateChanged(async (user) => {
    const heroTitle = document.getElementById("hero-title");
    const welcomeText = document.getElementById("welcome-text");

    if (user) {
        currentUser = user;
        
        try {
            // جلب المستند الخاص بالمستخدم من Firestore
            const userDoc = await db.collection("users").doc(user.uid).get();
            
            if (userDoc.exists && userDoc.data().name) {
                const displayName = userDoc.data().name;
                
                // تحديث النصوص بالاسم الحقيقي
                if (heroTitle) heroTitle.textContent = `Welcome back, ${displayName}!`;
                if (welcomeText) welcomeText.textContent = "Welcome, " + displayName;
            } else {
                // إذا لم يوجد اسم في Firestore (حالة نادرة)
                if (heroTitle) heroTitle.textContent = `Welcome back!`;
                if (welcomeText) welcomeText.textContent = "Welcome!";
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
        
        loadWatchlist(); // تحميل القائمة الخاصة به
    } else {
        currentUser = null;
        if (heroTitle) heroTitle.textContent = "Smart Price Tracking for Saudi Retailers";
    }
});

// --- عمليات تسجيل الدخول والحساب الجديد ---

async function handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-pass").value;

    if (!validateInputs(email, password)) return;

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        // تخزين الاسم في Firestore فوراً
        await db.collection("users").doc(cred.user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Account created successfully!");
        showPage('dashboard');
    } catch (err) {
        alert(err.message);
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-pass").value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            showPage('dashboard');
        })
        .catch(err => alert(err.message));
}

function forgotPassword() {
    const email = document.getElementById("login-email").value.trim();
    if (email === "") {
        alert("Please enter your email in the login field first.");
        return;
    }
    auth.sendPasswordResetEmail(email)
        .then(() => alert("A password reset link has been sent to your email!"))
        .catch(err => alert(err.message));
}

function logout() {
    auth.signOut().then(() => {
        showPage("home");
    });
}

// --- نظام البحث والـ Watchlist ---

function performSearch() {
    const query = document.getElementById("search-input").value.trim();
    const productList = document.getElementById("product-list");

    if (query === "") {
        alert("Please enter a product name to search!");
        return;
    }

    // مسح النتائج السابقة وعرض الجديدة
    productList.innerHTML = `
    <div class="team-card" style="position:relative;">
        <i class="fa fa-times" onclick="clearResults()" style="position:absolute; right:15px; top:15px; cursor:pointer; color:#ff4d4d;"></i>
        <h3>${query}</h3>
        <p>Price: 3500 SAR</p>
        <button onclick="addToWatchlist('${query}', 3500)" class="auth-btn">Add to Watchlist</button>
    </div>`;
    
    showPage("results");
}

function clearResults() {
    document.getElementById("product-list").innerHTML = "";
    showPage("home");
}

async function addToWatchlist(name, price) {
    if (!currentUser) {
        alert("Please login first to track products.");
        showPage('login');
        return;
    }

    try {
        await db.collection("users").doc(currentUser.uid)
            .collection("watchlist").add({ 
                name: name, 
                price: price, 
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        alert(`${name} added to your watchlist!`);
        loadWatchlist();
    } catch (error) {
        alert("Error adding item: " + error.message);
    }
}

async function loadWatchlist() {
    const box = document.getElementById("watchlist");
    if (!box || !currentUser) return;
    
    try {
        const snap = await db.collection("users").doc(currentUser.uid)
            .collection("watchlist").orderBy("timestamp", "desc").get();

        box.innerHTML = "";
        if (snap.empty) {
            box.innerHTML = "<p>Your watchlist is empty.</p>";
            return;
        }

        snap.forEach(doc => {
            const item = doc.data();
            const id = doc.id;
            box.innerHTML += `
            <div class="wish-item">
                <span><strong>${item.name}</strong> - ${item.price} SAR</span>
                <i class="fa fa-trash-can" onclick="deleteItem('${id}')" style="cursor:pointer; color:#ff4d4d;" title="Delete"></i>
            </div>`;
        });
    } catch (e) {
        console.log("Error loading watchlist:", e);
    }
}

async function deleteItem(id) {
    if (confirm("Are you sure you want to remove this item?")) {
        try {
            await db.collection("users").doc(currentUser.uid)
                .collection("watchlist").doc(id).delete();
            loadWatchlist();
        } catch (error) {
            alert("Error deleting item.");
        }
    }
}