# LifeXP Frontend

Vanilla HTML, CSS, and JavaScript frontend for the LifeXP backend.

## Files

- `index.html` - login and signup screen
- `dashboard.html` - user stats, categories, random challenge, complete challenge
- `challenge.html` - static stored challenges and rapid dynamic challenges
- `leaderboard.html` - top players by XP
- `friends.html` - send and accept friend requests
- `style.css` - dark responsive UI
- `script.js` - API calls, auth, localStorage, page logic

## Run Locally

From this folder:

```bash
python -m http.server 5500 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:5500/index.html
```

## How Fetch Works

`fetch()` sends an HTTP request from the browser to your backend. For example, login sends:

```js
fetch("https://lifexp-backend.onrender.com/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ username, password })
});
```

The backend checks MongoDB and returns JSON. The frontend reads that JSON and updates the page.

## How The Frontend Talks To The Backend

The shared helper in `script.js` is `apiRequest(path, options)`. Every page uses it. It adds:

- The deployed backend base URL
- `Content-Type: application/json`
- `Authorization: Bearer TOKEN` when a user is logged in
- Error handling for failed requests

## How The Token Is Used

After login, the backend returns a JWT token. The frontend stores it in `localStorage`:

```js
localStorage.setItem("token", token);
localStorage.setItem("userId", user._id);
localStorage.setItem("user", JSON.stringify(user));
```

Protected requests send it like this:

```js
Authorization: Bearer TOKEN
```

The backend middleware verifies the token before allowing challenge, leaderboard, and friend actions.

## Data Flow

```text
User clicks button
↓
JavaScript fetch()
↓
Express route
↓
Controller
↓
MongoDB
↓
JSON response
↓
Frontend updates UI
```

## Challenge Modes

Static mode asks the backend for a random stored challenge from MongoDB. If the DB has no static challenges yet, the backend seeds the built-in challenge bank automatically.

Rapid mode asks the backend to generate a fresh timed challenge, save it to MongoDB, and return its real challenge ID. Completing it uses the same `/api/challenge/complete` flow as stored challenges.

Completion now uses a server-side challenge attempt. The backend creates an attempt when a challenge is issued, stores the earliest valid completion time, and rejects completions that arrive too fast.

## Admin

Set this in the backend environment before using `admin.html`:

```text
ADMIN_SECRET=choose-a-long-private-secret
```

The admin page sends this value as `x-admin-secret` and lets you monitor stats, delete users, add/delete challenges, and inspect recent attempts.

## Local Backend Testing

By default the frontend uses:

```text
https://lifexp-backend.onrender.com
```

To test against your local backend from the browser console:

```js
localStorage.setItem("apiBase", "http://127.0.0.1:5000");
location.reload();
```
