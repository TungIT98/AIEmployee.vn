        const API_BASE = 'http://localhost:3000/api';

        // Form submission handler
        document.getElementById('contactForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            // Show loading state
            submitBtn.textContent = 'Đang gửi...';
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');

            try {
                const response = await fetch(`${API_BASE}/contacts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    // Success - hide form and show success message
                    this.style.display = 'none';
                    document.getElementById('formSuccess').style.display = 'block';
                } else {
                    // Server error - show error message
                    alert(result.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                // Network error - API not available
                console.error('API Error:', error);
                alert('Không thể kết nối đến server. Vui lòng đảm bảo backend API đang chạy.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
