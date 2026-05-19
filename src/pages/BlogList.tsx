import { useState, useEffect } from 'react';
import { Footer } from '@/components/layout/Footer';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Zap, Search } from 'lucide-react';
import { SEO } from '@/components/seo/SEO';

import { BLOGS } from '@/data/blogs';

const BlogList = () => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // metadata handled by SEO component
  }, []);

  const searchTermLower = searchTerm.toLowerCase();
  const filteredBlogs = BLOGS.filter(blog => 
    blog.title.toLowerCase().includes(searchTermLower) ||
    blog.category.toLowerCase().includes(searchTermLower)
  );

  return (
    <div className="min-h-screen bg-black text-zinc-50 font-sans selection:bg-cyan-500/30">
      <SEO 
        title="Insights & Intelligence"
        description="The Intelligence Log: Advanced discourse on human resources, emerging technologies, and elite leadership protocols."
      />
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full mix-blend-screen filter blur-[100px] bg-cyan-900/20"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_100%,transparent_100%)]"></div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white group-hover:text-cyan-400 transition-colors duration-300">FastestHR</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-40 px-6 sm:pt-48 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center md:text-left md:flex justify-between items-end mb-16"
          >
            <div>
              <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">
                Intelligence <span className="text-cyan-400">Log.</span>
              </h1>
              <p className="text-xl text-zinc-400 font-light max-w-2xl">
                Advanced discourse on human resources, emerging technologies, and elite leadership protocols.
              </p>
            </div>
            
            <div className="mt-8 md:mt-0 relative w-full md:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Search className="w-5 h-5" />
              </div>
              <input 
                type="text" 
                placeholder="Search protocols..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-full py-3 pr-4 pl-10 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-light"
              />
            </div>
          </motion.div>

          {/* Featured/Latest Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBlogs.map((blog, idx) => (
              <motion.div
                key={blog.slug}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
                className="group relative flex flex-col h-full bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all cursor-pointer"
              >
                {/* Abstract Image Banner */}
                <Link to={`/blog/${blog.slug}`} className="absolute inset-0 z-20"></Link>
                
                <div className="h-48 relative overflow-hidden bg-[#111]">
                  <img 
                    src={blog.image} 
                    alt={blog.title} 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-br ${blog.gradient} opacity-20 group-hover:opacity-40 transition-opacity duration-500`}></div>
                  {/* Decorative Elements */}
                  <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-[#0a0a0a] to-transparent"></div>
                  <div className="absolute top-4 right-4 flex gap-2">
                    <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-mono text-zinc-300 border border-white/10">
                      {blog.category}
                    </span>
                  </div>
                </div>

                <div className="p-8 flex flex-col flex-1 relative z-10">
                  <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 mb-4">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {blog.readTime}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                    <span>{blog.date}</span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-3 tracking-tight group-hover:text-cyan-400 transition-colors leading-tight">
                    {blog.title}
                  </h3>
                  
                  <p className="text-zinc-400 font-light text-sm leading-relaxed mb-8 flex-1">
                    {blog.excerpt}
                  </p>
                  
                  <div className="mt-auto flex items-center text-sm font-medium text-cyan-500">
                    <span className="group-hover:mr-2 transition-all">Read Protocol</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredBlogs.length === 0 && (
            <div className="py-20 text-center text-zinc-500 font-light border border-white/5 rounded-3xl bg-[#0a0a0a]">
              No intelligence protocols found matching your query.
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogList;
