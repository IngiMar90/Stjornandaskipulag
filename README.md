# Stjórnandaskipulag

Sameiginlegt verkefnaborð fyrir stjórnendateymi.

## Virkni
- Sýna/fela verkefni eftir stjórnendum
- Einn eða fleiri ábyrgðaraðilar á verkefni
- Verkefni / Í vinnslu / Lokið
- Drag-and-drop milli stöðu
- Skiladagur og forgangur
- Stjórnendur með sér lit
- Staðbundin vistun ef enginn gagnagrunnur er tengdur
- Supabase rauntímauppfærsla milli tækja
- Innskráning með Supabase Auth
- PWA / uppsetjanlegt vefapp

## Supabase uppsetning
1. Búðu til Supabase project.
2. Keyrðu `supabase.sql` í SQL Editor.
3. Búðu til notendur undir Authentication > Users.
4. Finndu Project URL og anon/publishable key undir Project Settings > API.
5. Settu gildin í `config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_KEY'
};
```

`anon`/publishable lykill má vera í frontend. Ekki setja service-role lykil í GitHub eða vafrann.

## GitHub Pages
Forritið er static og má birta beint með GitHub Pages úr `main` branch / root. Eftir að Pages er virkjað verður slóðin venjulega:

`https://ingimar90.github.io/Stjornandaskipulag/`

Án Supabase stillinga virkar appið staðbundið á einu tæki. Til að fá sameiginleg gögn og rauntímauppfærslur þarf að klára Supabase skrefin hér að ofan.
