# Raven RS Garage

Three.js da yozilgan mashina tuning va ochiq shahar o'yini. Vite loyihasi.

## Ishga tushirish

1. [Node.js LTS](https://nodejs.org) o'rnating.
2. Shu papkada terminal oching:

```
npm install
npm run dev
```

3. Brauzerda `http://localhost:5173` ni oching.

Firebase sozlanmaguncha boshqa haydovchilar botlar bo'ladi. Shu brauzerda ikkinchi oyna ochsangiz, ikkala oyna bir-birini shaharda ko'radi (sinov uchun qulay).

## Papkalar

```
index.html            sahifa (menyu, HUD)
src/main.js           kirish nuqtasi
src/game.js           o'yinning o'zi: garaj, shahar, fizika, ovoz, HUD
src/style.css         ko'rinish
src/audio/            dvigatel halqalari va turbo yozuvi (ma'lumot)
src/net/config.js     Firebase sozlamalari (siz to'ldirasiz)
src/net/firebase.js   Firebase orqali multiplayer
src/net/connect.js    transport tanlash
database.rules.json   Firebase xavfsizlik qoidalari
```

`src/game.js` hali bitta katta fayl (5 mingdan ortiq qator). Ichida bo'limlar izohlar bilan ajratilgan.

## Firebase multiplayer

1. [Firebase console](https://console.firebase.google.com) da loyiha yarating.
2. **Build > Realtime Database > Create database**. Joylashuv: `europe-west1` (O'zbekistonga eng yaqini). "Locked mode" ni tanlang.
3. **Rules** bo'limiga `database.rules.json` ichidagi matnni qo'ying va **Publish** bosing.
4. **Build > Authentication > Sign-in method > Anonymous** ni yoqing.
5. **Project settings > Your apps > Web app (</>)** qo'shing. Chiqqan `firebaseConfig` ni `src/net/config.js` dagi `FIREBASE_CONFIG` ga ko'chiring. `databaseURL` qatori bo'lishi shart.
6. Saytni internetga qo'ygach, **Authentication > Settings > Authorized domains** ga sayt manzilini qo'shing (masalan `username.github.io`).

`ROOM` nomi bir xil bo'lgan hamma o'yinchi bitta shaharda yuradi. Do'stlar bilan alohida o'ynash uchun nomni o'zgartiring.

### Qanday ishlaydi

- Har bir mashina o'z kompyuterida hisoblanadi. Tarmoq sekinlashsa, o'zingizning rulingiz qotmaydi, faqat boshqalar kechikib ko'rinadi.
- Harakatlanayotganda soniyasiga ~10 marta, to'xtab turganda 1 marta joylashuv yuboriladi.
- Boshqa mashinalar 150 ms kechikish bilan, ikki xabar orasida silliq ko'rsatiladi.
- Oyna yopilsa yoki internet uzilsa, o'yinchi shahardan avtomatik o'chadi.

### Cheklovlar

- Firebase bepul tarifida oylik yuklab olish hajmi cheklangan. Bir xonada o'yinchi ko'p bo'lsa, tez tugaydi. Console'dagi **Usage** bo'limini kuzatib turing.
- Server hech narsani tekshirmaydi, shuning uchun aldashdan himoya yo'q.
- Yuklangan `.glb` mashinangiz boshqalarga ko'rinmaydi, ular sizni tanlangan oddiy mashinada ko'radi.
- Poygalar hozircha faqat botlar bilan. O'yinchilar orasidagi poyga hali yo'q.

## GitHub'ga qo'yish

```
git init
git add .
git commit -m "Raven RS Garage"
git branch -M main
git remote add origin https://github.com/USERNAME/raven-garage.git
git push -u origin main
```

GitHub'da **Settings > Pages > Source: GitHub Actions** ni tanlang. `.github/workflows/deploy.yml` har `git push` dan keyin saytni o'zi quradi va chiqaradi.

**Diqqat:** `src/audio/` ichidagi dvigatel yozuvlari pullik kutubxonadan bo'lsa, reponi **private** qiling. Bepul tarifda private repo uchun GitHub Pages ishlamaydi; bunday holda Cloudflare Pages yoki Netlify'dan foydalaning (ular private repodan ham quradi; build buyrug'i `npm run build`, papka `dist`).
