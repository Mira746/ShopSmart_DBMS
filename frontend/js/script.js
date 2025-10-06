// ShopSmart minimal interactivity
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Image enhancement: lazy-load and fallback
  function enhanceImages(root=document){
    const pexelsFallback = {
      Clothing: [
        'https://images.pexels.com/photos/1342609/pexels-photo-1342609.jpeg?auto=compress&cs=tinysrgb&w=1200',
        'https://images.pexels.com/photos/2983464/pexels-photo-2983464.jpeg?auto=compress&cs=tinysrgb&w=1200'
      ],
      Footwear: [
        'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=1200',
        'https://images.pexels.com/photos/1478442/pexels-photo-1478442.jpeg?auto=compress&cs=tinysrgb&w=1200'
      ]
    };

    $$('.product-card img, .hero-art img', root).forEach(img => {
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      if (!img.dataset.fallbackBound){
        img.dataset.fallbackBound = true;
        img.addEventListener('error', () => {
          const card = img.closest('.product-card');
          const cat = card?.dataset.category || 'Clothing';
          const idx = parseInt(img.dataset.retry || '0', 10);
          const srcs = pexelsFallback[cat] || pexelsFallback['Clothing'];
          if (idx < srcs.length){
            img.dataset.retry = String(idx + 1);
            img.src = srcs[idx];
          } else {
            img.src = 'images/fallback.svg';
          }
        });
      }
    });
  }

  // Image mapping
  const imageByName = { /* existing mapping as you already have */ };

  function applyImageMapping(root=document){
    let sig = 1;
    $$('.product-card', root).forEach(card => {
      const name = (card.dataset.name||'').trim();
      const cat = (card.dataset.category||'Clothing').trim();
      const img = $('img', card);
      if (!img) return;
      if (img.src) return; // skip if already has src
      if (imageByName[name]) img.src = imageByName[name];
      else img.src = `https://source.unsplash.com/800x800/?${encodeURIComponent(name + ', ' + cat + ', fashion')}&sig=${sig++}`;
    });
  }

  function ensureUniqueImages(root=document){
    const seen = new Set();
    let sig = 1;
    $$('.product-card img', root).forEach(img => {
      const url = img.src || '';
      if (seen.has(url) && url.includes('source.unsplash.com')){
        img.src = `https://source.unsplash.com/1200x900/?fashion,apparel,clothes&sig=${sig++}`;
      } else if (url) seen.add(url);
    });
  }

  // =====================
  // Cart functionality
  // =====================

  // Helper functions
  const getCart = () => JSON.parse(localStorage.getItem('cart') || '[]');
  const setCart = (items) => localStorage.setItem('cart', JSON.stringify(items));
  const addToCart = (item) => {
    const cart = getCart();
    const idx = cart.findIndex(x => x.id === item.id);
    if (idx > -1) {
      cart[idx].qty += item.qty || 1;
    } else {
      cart.push(item);
    }
    setCart(cart);
  };

  // =====================
  // Add-to-Cart button
  // =====================
  $$('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.product-card');
      if (!card) return;

      addToCart({
        id: card.dataset.id,
        name: card.dataset.name,
        price: parseFloat(card.dataset.price || 0),
        qty: 1,
        image: $('img', card)?.src || 'images/product1.svg'
      });

      btn.textContent = 'Added ✓';
      setTimeout(() => btn.textContent = '+ Add to Cart', 1000);
    });
  });

  // Product filtering & sorting
  const grid = $('#productGrid');
  if (grid){
    const priceRange = $('#priceRange');
    const priceValue = $('#priceValue');
    const sortSel = $('#sort');
    const resetBtn = $('#resetFilters');

    const prices = $$('.product-card', grid).map(c=>parseFloat(c.dataset.price||0));
    const maxPrice = Math.max(...prices, 1000);
    if(priceRange) { priceRange.max = maxPrice; priceRange.value = maxPrice; }

    function applyFilters(){
      const max = parseFloat(priceRange?.value||maxPrice);
      if(priceValue) priceValue.textContent = `₹${max}`;
      const selectedCats = $$('input[name="category"]:checked').map(c=>c.value);
      const cards = $$('.product-card', grid);
      cards.forEach(card=>{
        const price = parseFloat(card.dataset.price||0);
        const cat = card.dataset.category;
        const show = price <= max && (selectedCats.length===0 || selectedCats.includes(cat));
        card.style.display = show?'':'none';
      });

      const sort = sortSel?.value || 'popular';
      const visible = cards.filter(c=>c.style.display!=='none');
      visible.sort((a,b)=>{
        const pa = parseFloat(a.dataset.price||0);
        const pb = parseFloat(b.dataset.price||0);
        if(sort==='low-high') return pa-pb;
        if(sort==='high-low') return pb-pa;
        return 0;
      }).forEach(c=>grid.appendChild(c));

      applyImageMapping(grid);
      ensureUniqueImages(grid);
      enhanceImages(grid);
    }

    sortSel?.addEventListener('change', applyFilters);
    $$('input[name="category"]').forEach(c=>c.addEventListener('change', applyFilters));
    priceRange?.addEventListener('input', applyFilters);

    resetBtn?.addEventListener('click', ()=>{
      $$('input[name="category"]').forEach(c=>c.checked=true);
      if(priceRange) priceRange.value = priceRange.max;
      if(sortSel) sortSel.value = 'popular';
      applyFilters();
    });

    const params = new URLSearchParams(location.search);
    const catParam = params.get('category');
    if(catParam){
      $$('input[name="category"]').forEach(c=>c.checked=(c.value===catParam));
    }

    applyFilters();
  }

  // Footer year
  const yearEl = $('#year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  // Theme
  const savedTheme = localStorage.getItem('theme');
  if(savedTheme==='light') document.body.classList.add('light');
  $$('[data-theme]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const theme = btn.getAttribute('data-theme');
      document.body.classList.toggle('light', theme==='light');
      localStorage.setItem('theme', theme);
    });
  });

  // Enhance all images initially
  applyImageMapping(document);
  ensureUniqueImages(document);
  enhanceImages(document);

  // =====================
  // Checkout button
  // =====================
  document.addEventListener('DOMContentLoaded', () => {
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', async () => {
        const cart = getCart();
        if (cart.length === 0) { alert("Your cart is empty!"); return; }
        try {
          const response = await fetch("/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart })
          });
          const data = await response.json();
          if (data.success) {
            alert("Order placed successfully!");
            localStorage.removeItem('cart');
            window.location.href = "/index.html";
          } else {
            alert("Failed to place order. Try again!");
          }
        } catch (err) {
          console.error(err);
          alert("Error connecting to server.");
        }
      });
    }
  });

  // =====================
  // Render cart page
  // =====================
  document.addEventListener('DOMContentLoaded', () => {
    const cartContainer = document.getElementById('cartItems');
    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('total');

    if (cartContainer) {
      const cart = getCart();
      cartContainer.innerHTML = '';

      if (cart.length === 0) {
        cartContainer.innerHTML = '<p>Your cart is empty.</p>';
        if (subtotalEl) subtotalEl.textContent = '₹0';
        if (totalEl) totalEl.textContent = '₹0';
        return;
      }

      let subtotal = 0;

      cart.forEach(item => {
        subtotal += item.price * item.qty;

        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
          <img src="${item.image}" alt="${item.name}" class="cart-item-img"/>
          <div class="cart-item-details">
            <h5>${item.name}</h5>
            <p>₹${item.price} × ${item.qty}</p>
          </div>
          <button class="remove-item">Remove</button>
        `;
        cartContainer.appendChild(itemEl);

        // Remove item button
        itemEl.querySelector('.remove-item').addEventListener('click', () => {
          const updatedCart = getCart().filter(x => x.id !== item.id);
          setCart(updatedCart);
          itemEl.remove();
          // Recalculate subtotal/total
          let newSubtotal = 0;
          getCart().forEach(i => newSubtotal += i.price * i.qty);
          if (subtotalEl) subtotalEl.textContent = `₹${newSubtotal}`;
          if (totalEl) totalEl.textContent = `₹${newSubtotal}`;
          if (getCart().length === 0) {
            cartContainer.innerHTML = '<p>Your cart is empty.</p>';
            if (subtotalEl) subtotalEl.textContent = '₹0';
            if (totalEl) totalEl.textContent = '₹0';
          }
        });
      });

      if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
      if (totalEl) totalEl.textContent = `₹${subtotal}`; // you can add shipping if needed
    }
  });

})();