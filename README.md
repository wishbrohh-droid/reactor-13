# NOVA — Premium Video Platform Template

A futuristic, production-grade video streaming frontend template.
Dark theme · Neon accents · Glassmorphism · Particle effects · 4 pages

---

## File Structure

```
NOVA-template/
├── index.html          ← Homepage: hero, features, video gallery
├── video.html          ← Video player page + sidebar recommendations
├── upload.html         ← Upload UI with drag & drop + form
├── admin.html          ← Admin dashboard with stats, chart, video table
├── css/
│   └── style.css       ← All styles (global + per-page)
├── js/
│   └── script.js       ← All JS: cursor, particles, animations, toasts
└── assets/             ← Place your images/thumbnails here
```

---

## Features

- ✅ Custom animated cursor with ring tracker
- ✅ Floating particle canvas background (WebGL-style)
- ✅ Smooth page fade transitions
- ✅ Scroll-reveal animations (IntersectionObserver)
- ✅ Animated hero counters
- ✅ Video gallery with category filter
- ✅ Sticky glassmorphic navbar
- ✅ Mobile drawer navigation
- ✅ Cinematic video player UI
- ✅ Drag & drop upload zone with simulated progress
- ✅ Admin dashboard with animated stats + chart
- ✅ Video management table with delete confirm modal
- ✅ Toast notification system
- ✅ Parallax scrolling on hero
- ✅ Fully responsive (desktop / tablet / mobile)

---

## How to Connect a Backend

### Video Player (video.html)
Set the `src` attribute on the `#main-video` element:
```html
<video id="main-video" src="https://your-cdn.com/video.mp4" controls></video>
```
Or via JavaScript:
```js
document.getElementById('main-video').src = 'YOUR_VIDEO_URL';
```

### Upload Form (upload.html)
Replace the simulated upload with a real `fetch` POST:
```js
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('title', title);

const res = await fetch('/api/videos', { method: 'POST', body: formData });
const data = await res.json();
```

### Gallery (index.html)
Fetch videos from your API and inject cards dynamically:
```js
const videos = await fetch('/api/videos').then(r => r.json());
// Map to .video-card HTML and append to #video-grid
```

### Admin Dashboard (admin.html)
Replace static data arrays with API calls to your backend.

---

## Customization

### Change accent color
Edit in `css/style.css`:
```css
:root {
  --neon: #00e5ff;  /* ← Change this */
}
```

### Change logo name
Find all `NOV<span>A</span>` in HTML files and replace with your brand.

### Add real video thumbnails
Replace the `.thumb-1` through `.thumb-6` gradient placeholders with:
```html
<img src="assets/thumb-01.jpg" class="card-thumb-img" alt="Title" />
```

---

## Password: `veltrix2024` (from previous VΞLTRIX session)
This is a frontend-only template. Authentication should be implemented server-side.

---

© 2026 NOVA Template — Premium Frontend Template
