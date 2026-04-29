// Mobile Navigation
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");

hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
});

document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
    hamburger.classList.remove("active");
    navMenu.classList.remove("active");
}));

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-container') && navMenu.classList.contains('active')) {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
    }
});

// Quiz Modal
const modal = document.getElementById("quiz-modal");
const playButtons = document.querySelectorAll(".play-btn");
const closeModal = document.querySelector(".close-modal");

playButtons.forEach(button => {
    button.addEventListener("click", () => {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden"; // Prevent background scrolling
    });
});

closeModal.addEventListener("click", () => {
    modal.style.display = "none";
    document.body.style.overflow = "auto"; // Re-enable scrolling
});

window.addEventListener("click", (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto"; // Re-enable scrolling
    }
});

// Game Filtering
const filterButtons = document.querySelectorAll(".filter-btn");
const gameCards = document.querySelectorAll(".game-card");

filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        // Remove active class from all buttons
        filterButtons.forEach(btn => btn.classList.remove("active"));
        
        // Add active class to clicked button
        button.classList.add("active");
        
        const filter = button.getAttribute("data-filter");
        
        gameCards.forEach(card => {
            if (filter === "all" || card.getAttribute("data-type") === filter) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }
        });
    });
});

// Animated Counter
const counters = document.querySelectorAll('.stat h4');
const speed = 200;

const animateCounters = () => {
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-count');
        const count = +counter.innerText.replace('%', '').replace('+', '').replace('k', '000');
        const increment = Math.ceil(target / speed);
        
        if (count < target) {
            let newCount = count + increment;
            if (counter.innerText.includes('k')) {
                counter.innerText = (newCount/1000).toFixed(0) + 'k';
            } else if (counter.innerText.includes('%')) {
                counter.innerText = newCount + '%';
            } else if (counter.innerText.includes('+')) {
                counter.innerText = newCount + '+';
            } else {
                counter.innerText = newCount;
            }
            setTimeout(() => animateCounters(), 1);
        } else {
            if (counter.innerText.includes('k')) {
                counter.innerText = (target/1000).toFixed(0) + 'k';
            } else if (counter.innerText.includes('%')) {
                counter.innerText = target + '%';
            } else if (counter.innerText.includes('+')) {
                counter.innerText = target + '+';
            } else {
                counter.innerText = target;
            }
        }
    });
};

// Run counters when element is in viewport
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

if (document.querySelector('.impact-stats')) {
    observer.observe(document.querySelector('.impact-stats'));
}

// Prevent default behavior for all anchor links that don't have a href value
document.querySelectorAll('a[href="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
    });
});