# SWAPLY REST API Dokumentatsioon

See dokument on ametlik API leping (**API Contract**) meeskonnaliikmetele (**Person B** ja **Person C**).  
Kõik endpointid töötavad **nii otse** (nt `/users/1`) **kui ka `/api` eesliitega** (nt `/api/users/1`).

Serveri baasaadress lokaalselt: `http://localhost:5000`

---

## 🔐 Autentimine ja päised

Kõik päringud (välja arvatud `/auth/*`, `/health` ja `/uploads/*`) nõuavad JWT tokenit päises:
```http
Authorization: Bearer <sinu_jwt_token>
```
Kui token puudub või on vigane, tagastatakse `401 Unauthorized`:
```json
{ "error": "Invalid or expired token" }
```

---

## 1. Autentimine (`/auth`)

### 1.1 Registreerimine
- **Meetod:** `POST`
- **Teekond:** `/auth/register` või `/api/auth/register`
- **Päised:** `Content-Type: application/json`
- **Päringu keha:**
```json
{
  "email": "jaanis@example.com",
  "password": "Password123!",
  "name": "Jaanis Maala"
}
```
- **Vastuskood:** `201 Created`
- **Vastus:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": 1,
    "email": "jaanis@example.com",
    "name": "Jaanis Maala"
  }
}
```

---

### 1.2 Sisselogimine
- **Meetod:** `POST`
- **Teekond:** `/auth/login` või `/api/auth/login`
- **Päised:** `Content-Type: application/json`
- **Päringu keha:**
```json
{
  "email": "jaanis@example.com",
  "password": "Password123!"
}
```
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": 1,
    "email": "jaanis@example.com",
    "name": "Jaanis Maala"
  }
}
```

---

### 1.3 Väljalogimine
- **Meetod:** `POST`
- **Teekond:** `/auth/logout` või `/api/auth/logout`
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "message": "Logged out successfully"
}
```

---

## 2. Minu profiil (`/me`)

### 2.1 Autenditud kasutaja kokkuvõte
- **Meetod:** `GET`
- **Teekond:** `/me` või `/api/me`
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "id": 1,
  "name": "Jaanis Maala",
  "email": "jaanis@example.com",
  "profile_picture": "/uploads/avatars/default-avatar.svg",
  "is_completed": true
}
```
*(Märkus: kui kasutajal pilti pole, on `profile_picture` automaatselt vaikimisi placeholder `👤`)*

---

### 2.2 Minu "About Me" ja asukoha vaatamine
- **Meetod:** `GET`
- **Teekond:** `/me/profile` või `/api/me/profile`
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "id": 1,
  "name": "Jaanis Maala",
  "about_me": "Armastan tehnikat, jalgrattaid ja 3D-printimist.",
  "city": "Tallinn",
  "latitude": 59.437,
  "longitude": 24.753,
  "is_completed": true
}
```

---

### 2.3 Minu "About Me" ja asukoha muutmine
- **Meetod:** `PUT`
- **Teekond:** `/me/profile` või `/api/me/profile`
- **Päised:** `Content-Type: application/json`
- **Päringu keha:**
```json
{
  "name": "Jaanis M.",
  "about_me": "Uuendatud tutvustus...",
  "city": "Tartu",
  "latitude": 58.378,
  "longitude": 26.729
}
```
- **Vastuskood:** `200 OK`

---

### 2.4 Minu biograafiliste andmete ja eelistuste vaatamine
- **Meetod:** `GET`
- **Teekond:** `/me/bio` või `/api/me/bio`
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "id": 1,
  "interests": ["cycling", "electronics", "3d-printing"],
  "preferred_categories": ["technology", "sports", "tools"],
  "preferred_conditions": ["new", "like_new"],
  "min_value": 50.00,
  "max_value": 500.00,
  "max_distance_km": 30,
  "weights": {
    "category": 3,
    "value": 2,
    "distance": 2,
    "condition": 1,
    "interests": 1
  }
}
```

---

### 2.5 Minu biograafiliste andmete muutmine
- **Meetod:** `PUT`
- **Teekond:** `/me/bio` või `/api/me/bio`
- **Päised:** `Content-Type: application/json`
- **Päringu keha:**
```json
{
  "interests": ["cycling", "woodworking"],
  "preferred_categories": ["tools", "sports"],
  "preferred_conditions": ["like_new", "good"],
  "min_value": 20,
  "max_value": 400,
  "max_distance_km": 50,
  "weights": {
    "category": 3,
    "value": 2,
    "distance": 1,
    "condition": 2,
    "interests": 1
  }
}
```
- **Vastuskood:** `200 OK`
- **Vastus:** Tagastab uuendatud bio objekti koos väljaga `"is_completed": true/false`.

---

### 2.6 Profiilipildi üleslaadimine
- **Meetod:** `POST`
- **Teekond:** `/me/avatar` või `/api/me/avatar`
- **Päised:** `Content-Type: multipart/form-data`
- **Vormi väli:** `avatar` (pildifail: JPG, PNG, WEBP)
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "profile_picture": "/uploads/avatars/avatar-1-1730588000000.jpg"
}
```

---

### 2.7 Profiilipildi eemaldamine
- **Meetod:** `DELETE`
- **Teekond:** `/me/avatar` või `/api/me/avatar`
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "profile_picture": "/uploads/avatars/default-avatar.svg"
}
```

---

## 3. Minu aktiivne vahetusese (`/me/item`)

> **Reegel:** Igal kasutajal saab korraga olla ainult **1 aktiivne ese** (`status = 'active'`).

### 3.1 Minu aktiivse eseme vaatamine
- **Meetod:** `GET`
- **Teekond:** `/me/item` või `/api/me/item`
- **Vastuskood:** `200 OK`
- **Vastus:** *(või `null`, kui eset pole veel lisatud)*
```json
{
  "id": 10,
  "user_id": 1,
  "title": "Gravel Jalgratas 2024",
  "description": "Väga heas korras, 56cm raam, Shimano käiguvaheti.",
  "category": "sports",
  "condition": "like_new",
  "estimated_value": 450.00,
  "image_url": "/uploads/items/item-1-1730588200000.jpg",
  "status": "active",
  "created_at": "2026-11-02T22:30:00Z"
}
```

---

### 3.2 Uue vahetuseseme lisamine
- **Meetod:** `POST`
- **Teekond:** `/me/item` või `/api/me/item`
- **Päised:** `Content-Type: multipart/form-data` või `application/x-www-form-urlencoded`
- **Vormi väljad:**
  - `title` *(kohustuslik)*: nt `"Gravel Jalgratas 2024"`
  - `description` *(valikuline)*: nt `"Väga heas korras..."`
  - `category` *(kohustuslik)*: nt `"sports"`
  - `condition` *(kohustuslik)*: nt `"like_new"`
  - `estimated_value` *(valikuline arv)*: nt `450`
  - `image` *(valikuline pildifail)*: JPG/PNG fail
- **Vastuskood:** `201 Created`
- **Märkus:** Kui kasutajal on juba aktiivne ese olemas, tagastatakse `400 Bad Request`.

---

### 3.3 Vahetuseseme muutmine
- **Meetod:** `PUT`
- **Teekond:** `/me/item` või `/api/me/item`
- **Päised:** `Content-Type: multipart/form-data` või `application/x-www-form-urlencoded`
- **Vormi väljad:** `title`, `description`, `category`, `condition`, `estimated_value`, `image` *(kõik valikulised, muudab ainult saadetud väljad)*
- **Vastuskood:** `200 OK`

---

### 3.4 Vahetuseseme eemaldamine (arhiveerimine)
- **Meetod:** `DELETE`
- **Teekond:** `/me/item` või `/api/me/item`
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "message": "Item archived successfully"
}
```

---

## 4. Teiste kasutajate profiilid (`/users/:id`)

> ⚠️ **TÄHTIS PRIVAATSUSREEGEL (TASK.md & TESTING.md):**  
> Teise kasutaja andmeid tohib näha **AINULT** siis, kui:
> 1. Kasutaja on sinu aktiivsetes soovitustes, VÕI
> 2. Teie vahel on ootel connection request, VÕI
> 3. Te olete omavahel ühendatud (connection accepted).
> 
> **Kui luba puudub või ID-d ei eksisteeri, tagastab API rangelt `HTTP 404 Not Found`!**  
> E-posti aadressi ei tagastata mitte kunagi!

### 4.1 Teise kasutaja nimi ja pilt
- **Meetod:** `GET`
- **Teekond:** `/users/{id}` või `/api/users/{id}`
- **Vastuskood:** `200 OK` (või `404 Not Found`)
- **Vastus:**
```json
{
  "id": 2,
  "name": "Mari Maasikas",
  "profile_picture": "/uploads/avatars/default-avatar.svg"
}
```

---

### 4.2 Teise kasutaja tutvustus ja asukoht
- **Meetod:** `GET`
- **Teekond:** `/users/{id}/profile` või `/api/users/{id}/profile`
- **Vastuskood:** `200 OK` (või `404 Not Found`)
- **Vastus:**
```json
{
  "id": 2,
  "about_me": "Mulle meeldib lauamänge mängida ja asju vahetada.",
  "city": "Tallinn"
}
```

---

### 4.3 Teise kasutaja biograafilised andmed
- **Meetod:** `GET`
- **Teekond:** `/users/{id}/bio` või `/api/users/{id}/bio`
- **Vastuskood:** `200 OK` (või `404 Not Found`)
- **Vastus:**
```json
{
  "id": 2,
  "interests": ["gaming", "boardgames"],
  "preferred_categories": ["technology", "games"],
  "preferred_conditions": ["new", "like_new"],
  "min_value": 30.00,
  "max_value": 300.00,
  "max_distance_km": 20,
  "weights": { "category": 3, "value": 2, "distance": 1 }
}
```

---

### 4.4 Teise kasutaja aktiivne vahetusese
- **Meetod:** `GET`
- **Teekond:** `/users/{id}/item` või `/api/users/{id}/item`
- **Vastuskood:** `200 OK` (või `404 Not Found`)
- **Vastus:**
```json
{
  "id": 15,
  "user_id": 2,
  "title": "Sony PlayStation 5",
  "description": "Kaasa 2 pulti ja mängud.",
  "category": "technology",
  "condition": "like_new",
  "estimated_value": 400.00,
  "image_url": "/uploads/items/item-2-1730588500000.jpg",
  "status": "active"
}
```

---

## 5. Soovitused ja ühendused

### 5.1 Soovitused (`/recommendations`)
- **Meetod:** `GET`
- **Teekond:** `/recommendations` või `/api/recommendations`
- **Vastuskood:** `200 OK`
- **Reeglid:**
  - Kui päringu tegija profiil **ei ole täielikult täidetud**, tagastatakse tühi nimekiri `[]`.
  - Tagastab **ainult kasutajate ID-de massiivi** (maksimaalselt 10 ID-d), järjestatuna parimast halvimani:
```json
[2, 7, 12, 19, 3]
```

*(Person C frontend teeb nende ID-de põhjal päringud `/users/2`, `/users/2/profile`, `/users/2/item`, et kuvada kaarte)*

---

### 5.2 Ühendused (`/connections`)
- **Meetod:** `GET`
- **Teekond:** `/connections` või `/api/connections`
- **Vastuskood:** `200 OK`
- **Vastus:** Tagastab ühendatud (aktsepteeritud Match) kasutajate ID-d:
```json
[2, 5]
```

---

## 6. Arenduse ja testimise abivahend (`/dev/reset`)

- **Meetod:** `POST`
- **Teekond:** `/dev/reset` või `/api/dev/reset`
- **Autentimine:** Ei nõua tokenit (avatud arenduseks ja retsensiooniks).
- **Otstarve:** Tühjendab kõik andmebaasi tabelid 0 kasutajani (täidab TASK.md rida 131 nõude).
- **Vastuskood:** `200 OK`
- **Vastus:**
```json
{
  "message": "Database reset complete. All tables truncated.",
  "status": "empty"
}
```
