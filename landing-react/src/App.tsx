import Nav from './components/Nav';
import Footer from './components/Footer';
import Hero from './components/Hero';
import InteractiveDemo from './components/InteractiveDemo';
import Features from './components/Features';
import Testimonials from './components/Testimonials';
import Pricing from './components/Pricing';
import Faq from './components/Faq';
import ContactForm from './components/ContactForm';

export default function App() {
  return (
    <div className="overflow-x-hidden">
      <Nav />
      <main>
        <Hero />
        <InteractiveDemo />
        <Features />
        <Testimonials />
        <Pricing />
        <Faq />
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}
