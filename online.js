/* =====================================================================
   online.js — Cuentas y rankings ONLINE (opcional).

   Si lo dejas como está (null), las cuentas funcionan igual, pero se
   guardan SÓLO en este navegador: los rankings son de las cuentas
   creadas en este ordenador.

   Para que todo el mundo que juegue a tu juego comparta cuentas y
   rankings, usa Firebase (gratis, sin montar ningún servidor):
     1. Entra en https://console.firebase.google.com y crea un proyecto.
     2. Build → Authentication → Comenzar → activa "Correo electrónico/contraseña".
     3. Build → Firestore Database → Crear base de datos (modo producción).
        En la pestaña "Reglas" pega el contenido de firestore.rules y publica.
     4. Configuración del proyecto (⚙️) → Tus apps → icono web </> → registra
        la app y copia aquí el objeto firebaseConfig que te da.
     5. Si lo subes a GitHub Pages: Authentication → Configuración →
        Dominios autorizados → añade TU_USUARIO.github.io
   ===================================================================== */
window.G = window.G || {};

window.G.FIREBASE = {
  apiKey: "AIzaSyCnM-R0wx7kqf0neGzrnhfHuL-fX9z4VxA",
  authDomain: "isle-royale-7bc23.firebaseapp.com",
  projectId: "isle-royale-7bc23",
  storageBucket: "isle-royale-7bc23.firebasestorage.app",
  messagingSenderId: "988690625822",
  appId: "1:988690625822:web:f94e9ea5f7defe9604050f"
};

/* Ejemplo (con TUS datos):
window.G.FIREBASE = {
  apiKey: 'AIza...',
  authDomain: 'mi-isla-royale.firebaseapp.com',
  projectId: 'mi-isla-royale',
  appId: '1:1234567890:web:abcdef',
};
*/
