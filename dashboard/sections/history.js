let allProperties = [];

async function init_history() {
  // Require a logged-in user
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) {
    document.getElementById('propertiesContainer').innerHTML = `
      <div class="no-properties">
        <div class="no-properties-icon">🔒</div>
        <h3 style="margin-bottom:10px;">Please login</h3>
        <p style="margin-bottom:20px;color:#9ca3af;">Login to view properties you posted</p>
        <button onclick="window.location.href='/Login.html'" 
                style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;">
          Go to Login
        </button>
      </div>
    `;
    return;
  }

  // Load properties immediately
  await loadHistory();
  
  // Setup filter event listeners
  document.getElementById('searchInput').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
      loadHistory();
    }
  });
  
  document.getElementById('typeFilter').addEventListener('change', loadHistory);
}

// Listen for new properties posted elsewhere in the app and append them
window.addEventListener('propertyPosted', (e) => {
  try {
    const prop = e.detail;
    if (!prop) return;
    // ensure array exists
    if (!Array.isArray(allProperties)) allProperties = [];
    // normalize fields to match displayProperties usage
    const normalized = Object.assign({ createdAt: prop.createdAt || new Date().toISOString() }, prop);
    allProperties.unshift(normalized);
    displayProperties(allProperties);
    updateStatistics(allProperties);
  } catch (err) { console.warn('propertyPosted handler error', err); }
});

async function loadHistory() {
  // Get logged-in user and query their new-properties (property_listings)
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) return;

  const searchTerm = document.getElementById('searchInput').value || '';
  const type = document.getElementById('typeFilter').value;

  // Show loading state
  document.getElementById('propertiesContainer').innerHTML = `
    <div style="display:flex;justify-content:center;padding:40px;">
      <div style="width:40px;height:40px;border:4px solid #f3f4f6;border-top:4px solid #10b981;border-radius:50%;animation:spin 1s linear infinite;"></div>
    </div>
  `;
  
  try {
    // Fetch from the new properties endpoint for this user
    const params = new URLSearchParams();
    params.append('userId', user.id);
    const response = await fetch(`http://localhost:5001/api/newproperties?${params.toString()}`);

    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Failed to load properties');

    // Client-side filtering for search and type
    let props = Array.isArray(data.properties) ? data.properties.slice() : [];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      props = props.filter(p => {
        return (p.propertyType || '').toLowerCase().includes(q)
          || (p.city || '').toLowerCase().includes(q)
          || (p.address || '').toLowerCase().includes(q);
      });
    }
    if (type) props = props.filter(p => (p.type || '').toLowerCase() === type.toLowerCase());

    allProperties = props;
    displayProperties(allProperties);
    updateStatistics(allProperties);
  } catch (error) {
    console.error('Error loading history:', error);
    document.getElementById('propertiesContainer').innerHTML = `
      <div class="no-properties">
        <div class="no-properties-icon">⚠️</div>
        <h3 style="margin-bottom:10px;">Error Loading Properties</h3>
        <p style="margin-bottom:20px;color:#9ca3af;">${error.message}</p>
        <button onclick="loadHistory()" 
                style="padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">
          Try Again
        </button>
      </div>
    `;
  }
}

function displayProperties(properties) {
  if (properties.length === 0) {
    document.getElementById('propertiesContainer').innerHTML = `
      <div class="no-properties">
        <div class="no-properties-icon">🏠</div>
        <h3 style="margin-bottom:10px;">No Properties Found</h3>
        <p style="margin-bottom:20px;color:#9ca3af;">You haven't posted any properties yet</p>
        <button onclick="loadSection('post')" 
                style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;">
          Post Your First Property
        </button>
      </div>
    `;
    return;
  }
  
  let html = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;">
  `;
  
  properties.forEach(property => {
    // Get image URL
    let imageUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150'><rect width='100%' height='100%' fill='%23f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14'>No Image</text></svg>";
    if (property.imageUrl) {
      let stored = property.imageUrl.toString().trim();
      stored = stored.replace(/^\/+/, "");
      if (!stored.startsWith("uploads")) {
        stored = "uploads/" + stored;
      }
      imageUrl = "http://localhost:5001/" + stored;
    }
    
    // Format date
    const postedDate = new Date(property.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    // Format price
    const formattedPrice = property.price ? '₹' + property.price : '₹0';
    
    // Type badge
    const typeBadge = property.type === 'sell' ? 'FOR SALE' : 'FOR RENT';
    const typeBadgeColor = property.type === 'sell' ? '#ef4444' : '#f59e0b';
    
    html += `
      <div class="property-card">
        <!-- Type Badge -->
        <div style="position:absolute;top:15px;left:15px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold;color:white;background:${typeBadgeColor};z-index:2;">
          ${typeBadge}
        </div>
        
        <!-- Property Image -->
        <div style="position:relative;height:200px;overflow:hidden;">
          <img src="${imageUrl}" alt="${property.propertyType || 'Property'}" class="property-image">
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent, rgba(0,0,0,0.7));padding:15px;">
            <div style="color:white;font-size:18px;font-weight:bold;">${property.propertyType || 'Property'}</div>
            <div style="color:rgba(255,255,255,0.9);font-size:14px;">${property.city || ''}</div>
          </div>
        </div>
        
        <!-- Property Details -->
        <div style="padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:15px;">
            <div>
              <h3 style="margin:0 0 8px 0;font-size:18px;color:#111;font-weight:600;">
                ${property.bedrooms || 'N/A'} • ${property.propertyType || 'Property'}
              </h3>
              <div style="font-size:14px;color:#6b7280;margin-bottom:5px;">
                <i class="fas fa-map-marker-alt"></i> ${property.address ? property.address.substring(0, 40) + (property.address.length > 40 ? '...' : '') : 'No address'}
              </div>
              <div style="font-size:12px;color:#9ca3af;">
                <i class="far fa-calendar"></i> Posted: ${postedDate}
              </div>
            </div>
            
            <div style="font-size:20px;font-weight:bold;color:#059669;">
              ${formattedPrice}
              ${property.type === 'rent' ? '<span style="font-size:12px;color:#6b7280;">/month</span>' : ''}
            </div>
          </div>
          
          <!-- Features -->
          <div style="background:#f8fafc;padding:10px;border-radius:8px;margin-bottom:12px;">
            <div style="font-size:13px;color:#4b5563;margin-bottom:6px;"><i class="fas fa-star"></i> Features</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">${property.features ? property.features.substring(0, 120) + (property.features.length > 120 ? '...' : '') : 'No features listed'}</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:#374151;">
              <div style="background:white;padding:6px 8px;border-radius:6px;border:1px solid #e6eef8;">Locality: <strong style="margin-left:6px;color:#111;font-weight:600;">${property.locality || '-'}</strong></div>
              <div style="background:white;padding:6px 8px;border-radius:6px;border:1px solid #e6eef8;">Built Up: <strong style="margin-left:6px;color:#111;font-weight:600;">${property.builtUpArea || '-'}</strong></div>
              <div style="background:white;padding:6px 8px;border-radius:6px;border:1px solid #e6eef8;">Carpet: <strong style="margin-left:6px;color:#111;font-weight:600;">${property.carpetArea || '-'}</strong></div>
              <div style="background:white;padding:6px 8px;border-radius:6px;border:1px solid #e6eef8;">Baths: <strong style="margin-left:6px;color:#111;font-weight:600;">${property.bathrooms || '-'}</strong></div>
            </div>
          </div>

          <!-- Amenities & Contact -->
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
            <div style="flex:1;background:#fff6f3;padding:10px;border-radius:8px;border:1px solid #ffe6d5;color:#7c2d12;">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Amenities</div>
              <div style="font-size:12px;color:#6b7280;">${property.amenities ? property.amenities : 'Not specified'}</div>
            </div>
            <div style="width:220px;background:#f3f4f6;padding:10px;border-radius:8px;border:1px solid #e9eef6;color:#374151;">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Contact</div>
              <div style="font-size:13px;color:#111;margin-bottom:4px;">${property.ownerName ? property.ownerName : 'Owner'}</div>
              <div style="font-size:13px;color:#0f172a;margin-bottom:4px;">${property.contactMobile ? '📞 ' + property.contactMobile : ''}</div>
              <div style="font-size:12px;color:#475569;">${property.contactEmail ? '✉️ ' + property.contactEmail : ''}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  document.getElementById('propertiesContainer').innerHTML = html;
}

function updateStatistics(properties) {
  // Total properties
  document.getElementById('totalCount').textContent = properties.length;
}

function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('typeFilter').value = '';
  loadHistory();
}

// Load history on page load
if (typeof init_history === 'function') {
  init_history();
}
