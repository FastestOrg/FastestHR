import { sanitizeHtml } from '@/lib/dompurify';
import { useEffect, useState } from 'react';
import { Footer } from '@/components/layout/Footer';
import { useParams, Link } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, Clock, Zap, Share2, Bookmark } from 'lucide-react';
import { SEO } from '@/components/seo/SEO';

import { BLOGS, BlogPost as BlogPostType } from '@/data/blogs';
import { AUTHORS } from '@/data/authors';

const BlogPost = () => {
  const { slug } = useParams();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [blogData, setBlogData] = useState<BlogPostType | null>(null);

  useEffect(() => {
    const post = BLOGS.find(b => b.slug === slug);
    if (post) {
      setBlogData(post);
    }
    window.scrollTo(0,0);
  }, [slug]);

  if (!blogData) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400 font-mono">LOADING PROTOCOL...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 font-sans selection:bg-cyan-500/30">
      <SEO 
        title={blogData.title}
        description={blogData.excerpt}
        image={blogData.image}
        article={true}
        author={blogData.author}
        date={blogData.date}
        category={blogData.category}
        type="article"
        faqs={blogData.faqs}
      />
      
      {/* Scroll Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-indigo-500 z-[60] origin-left"
        style={{ scaleX }}
      />

      {/* Navbar Minimal */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/blog" className="flex items-center gap-2 group cursor-pointer text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium text-sm">Back to Intelligence Log</span>
          </Link>
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <Zap className="w-4 h-4 text-cyan-400" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-16 px-6 overflow-hidden">
        {/* Glow Element */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-cyan-900/20 blur-[100px] pointer-events-none rounded-t-full"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto relative z-10"
        >
          <div className="flex justify-center mb-6">
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono font-semibold uppercase tracking-widest border border-cyan-500/20">
              {blogData.category}
            </span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-white mb-8 text-center leading-[1.15]">
            {blogData.title}
          </h1>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-zinc-400 mb-12">
            <Link 
              to={`/author/${AUTHORS.find(a => a.name === blogData.author)?.slug || 'fastesthr-ai-lab'}`}
              className="text-cyan-400 font-semibold hover:underline"
            >
              {blogData.author}
            </Link>
            <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
            <span>{blogData.date}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {blogData.readTime}</span>
          </div>

          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl mb-16 group">
            <img 
              src={blogData.image} 
              alt={blogData.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className={`absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60`}></div>
          </div>
        </motion.div>
      </header>

      {/* Main Content using Tailwind Typography */}
      <main className="px-6 pb-32">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          {/* Action Bar */}
          <div className="flex justify-between items-center py-6 border-y border-white/5 mb-12">
            <div className="text-zinc-500 text-sm">Published in Network</div>
            <div className="flex gap-4">
              <button
                className="text-zinc-400 hover:text-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] rounded-md"
                aria-label="Bookmark post"
                title="Bookmark post"
              >
                <Bookmark className="w-5 h-5" />
              </button>
              <button
                className="text-zinc-400 hover:text-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] rounded-md"
                aria-label="Share post"
                title="Share post"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <article 
            className="prose prose-invert prose-zinc max-w-none 
                       prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-zinc-100
                       prose-h2:text-3xl prose-h2:mt-16 prose-h2:mb-6
                       prose-h3:text-2xl prose-h3:mt-10
                       prose-p:text-zinc-300 prose-p:font-light prose-p:leading-relaxed prose-p:mb-6 prose-p:text-lg
                       prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:text-cyan-300 hover:prose-a:underline
                       prose-blockquote:border-cyan-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-zinc-200
                       prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(blogData.content) }}
          />

          {/* End of article marker */}
          <div className="flex justify-center mt-20 mb-10">
            <Zap className="w-6 h-6 text-zinc-800" />
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPost;
