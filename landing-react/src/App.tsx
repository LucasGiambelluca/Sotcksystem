import Nav from './components/Nav';
import Footer from './components/Footer';
import InteractiveDemo from './components/InteractiveDemo';
import ContactForm from './components/ContactForm';

export default function App() {
  return (
    <div className="overflow-x-hidden">
      <Nav />
      <main className="pt-20">
        {/* Hero (Task 6) */}
        <InteractiveDemo />
        {/* Features (Task 7) */}
        {/* Testimonials (Task 8) */}
        {/* Pricing (Task 9) */}
        {/* Faq (Task 10) */}
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}
