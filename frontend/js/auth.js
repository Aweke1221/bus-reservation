document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm'); // Assuming you have registerForm on register.html
    const loginMessage = document.getElementById('loginMessage');
    const registerMessage = document.getElementById('registerMessage'); // For register.html

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailOrUsername = document.getElementById('emailOrUsername').value;
            const password = document.getElementById('password').value;
            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emailOrUsername, password })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Login failed');
                }
                storeToken(data.token);
                storeUser({ _id: data._id, username: data.username, email: data.email, role: data.role });
                updateNav(); // Update nav immediately
                if (data.role === 'admin') {
                    window.location.href = 'admin/admin.html';
                } else {
                    window.location.href = 'index.html'; // Or user dashboard
                }
            } catch (error) {
                if(loginMessage) loginMessage.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
                console.error('Login error:', error);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            // const role = 'user'; // Or get from form if you allow choosing

            try {
                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password /*, role */})
                });
                const data = await response.json();
                 if (!response.ok) {
                    throw new Error(data.message || 'Registration failed');
                }
                // Optionally auto-login or redirect to login page
                if(registerMessage) registerMessage.innerHTML = `<div class="alert alert-success">Registration successful! Please <a href="login.html">login</a>.</div>`;
                registerForm.reset();
            } catch (error) {
                if(registerMessage) registerMessage.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
                console.error('Registration error:', error);
            }
        });
    }
});