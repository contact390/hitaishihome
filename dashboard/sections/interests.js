let allInterests = [];

async function init_interests() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) {
    document.getElementById('interestsList').innerHTML = `
      <div class="no-interests">
        <div class="no-interests-icon">🔒</div>
        <h3 style="margin-bottom:10px;">Please login</h3>
        <p style="margin-bottom:20px;color:#9ca3af;">Login to view your saved interests</p>
        <button onclick="window.location.href='/Login.html'" 
                style="padding:10px 20px;background:#f5576c;color:white;border:none;border-radius:6px;cursor:pointer;">
          Go to Login
        </button>
      </div>
    `;
    return;
  }

  const token = localStorage.getItem('token');
  const list = document.getElementById('interestsList');
  
  try {
    // Prefer listing_interests endpoint (for newproperties) which returns property details
    let json = null;
    try {
      const resp = await fetch(`http://localhost:5001/api/newproperties/interests?userId=${user.id}`);
      if (resp.ok) {
        const j2 = await resp.json();
        if (j2.success) json = { interests: Array.isArray(j2.interests) ? j2.interests : [] };
      }
    } catch (e) {
      console.warn('newproperties/interests fetch failed, falling back', e);
    }

    // Fallback to legacy /api/interests (dashboard route) which may contain different schema
    if (!json) {
      const response = await fetch(`http://localhost:5001/api/interests?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const j = await response.json();
      if (!j.success) throw new Error(j.message || 'Failed to load interests');
      json = { interests: Array.isArray(j.interests) ? j.interests : [] };
    }

    allInterests = json.interests;
    displayInterests(allInterests);
    document.getElementById('interestsCount').textContent = allInterests.length;
  } catch (error) {
    console.error('Error loading interests:', error);
    list.innerHTML = `
      <div class="no-interests">
        <div class="no-interests-icon">⚠️</div>
        <h3 style="margin-bottom:10px;">Error Loading Interests</h3>
        <p style="margin-bottom:20px;color:#9ca3af;">${error.message}</p>
        <button onclick="init_interests()" 
                style="padding:10px 20px;background:#f5576c;color:white;border:none;border-radius:6px;cursor:pointer;">
          Try Again
        </button>
      </div>
    `;
  }

  // Setup search listener
  const searchInput = document.getElementById('searchInterests');
  if (searchInput) {
    searchInput.addEventListener('keyup', filterInterests);
  }
}

function displayInterests(interests) {
  const list = document.getElementById('interestsList');
  
  if (interests.length === 0) {
    list.innerHTML = `
      <div class="no-interests">
        <div class="no-interests-icon">❤️</div>
        <h3 style="margin-bottom:10px;">No Interests Yet</h3>
        <p style="margin-bottom:20px;color:#9ca3af;">Start liking properties to save them here</p>
        <button onclick="loadSection('browse')" 
                style="padding:10px 20px;background:#f5576c;color:white;border:none;border-radius:6px;cursor:pointer;">
          Browse Properties
        </button>
      </div>
    `;
    return;
  }
  
  let html = '<div style="display:grid;gap:20px;">';
  
  interests.forEach(interest => {
    // Get property details (stored in interests table or linked property)
    const propertyType = interest.propertyType || 'Property';
    const city = interest.city || 'N/A';
    const price = interest.price ? '₹' + interest.price : '₹0';
    const bedrooms = interest.bedrooms || 'N/A';
    const address = interest.address ? interest.address.substring(0, 50) + (interest.address.length > 50 ? '...' : '') : 'No address';
    
    // Get image URL
    let imageUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150'><rect width='100%' height='100%' fill='%23f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14'>No Image</text></svg>";
    if (interest.imageUrl) {
      let stored = interest.imageUrl.toString().trim();
      stored = stored.replace(/^\/+/, "");
      if (!stored.startsWith("uploads")) {
        stored = "uploads/" + stored;
      }
      imageUrl = "http://localhost:5001/" + stored;
    }
    
    // Format date
    const interestedDate = new Date(interest.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    html += `
      <div class="interest-card">
        <img src="${imageUrl}" alt="${propertyType}" class="interest-image">
        <div class="interest-details">
          <div>
            <h3 style="margin:0 0 10px 0;font-size:18px;color:#111;font-weight:600;">
              ${bedrooms} • ${propertyType}
            </h3>
            <div style="font-size:14px;color:#6b7280;margin-bottom:5px;">
              <i class="fas fa-map-marker-alt"></i> ${address}
            </div>
            <div style="font-size:13px;color:#6b7280;">
              <i class="fas fa-city"></i> ${city}
            </div>
            <div style="font-size:12px;color:#9ca3af;margin-top:5px;">
              <i class="fas fa-heart"></i> Saved on: ${interestedDate}
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid #e5e7eb;">
            <div style="font-size:24px;font-weight:bold;color:#f5576c;">
              ${price}
            </div>
            <button onclick="removeInterest(${interest.propertyId})" 
                    style="background:#fee2e2;color:#dc2626;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
              Remove
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  list.innerHTML = html;
}

function filterInterests() {
  const searchTerm = document.getElementById('searchInterests').value.toLowerCase();
  const filtered = allInterests.filter(interest => {
    return (interest.propertyType || '').toLowerCase().includes(searchTerm)
        || (interest.city || '').toLowerCase().includes(searchTerm)
        || (interest.address || '').toLowerCase().includes(searchTerm);
  });
  displayInterests(filtered);
}

function removeInterest(propertyId) {
  if (confirm('Remove this property from interests?')) {
    // perform server delete then update UI
    (async function(){
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user || !user.id) { alert('Please login'); return; }
        const res = await fetch('http://localhost:5001/api/newproperties/interest', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, propertyListingId: propertyId })
        });
        const j = await res.json();
        if (!j.success) { alert(j.message || 'Failed to remove'); return; }
        // remove from UI
        allInterests = allInterests.filter(i => i.propertyId !== propertyId);
        displayInterests(allInterests);
        document.getElementById('interestsCount').textContent = allInterests.length;
        // notify other parts of app
        try { window.dispatchEvent(new CustomEvent('interestRemoved', { detail: { propertyId } })); } catch (e) {}
      } catch (err) {
        console.error('removeInterest error', err);
        alert('Connection error');
      }
    })();
  }
}

// Call init when page loads
if (typeof init_interests === 'function') {
  init_interests();
}

// Listen for interests added elsewhere (e.g., from browse page) and append
window.addEventListener('interestAdded', (e) => {
  try {
    const item = e.detail;
    if (!item) return;
    if (!Array.isArray(allInterests)) allInterests = [];
    // normalize fields
    const normalized = Object.assign({ createdAt: item.createdAt || new Date().toISOString() }, item);
    allInterests.unshift(normalized);
    displayInterests(allInterests);
    const countEl = document.getElementById('interestsCount');
    if (countEl) countEl.textContent = allInterests.length;
  } catch (err) { console.warn('interestAdded handler error', err); }
});
