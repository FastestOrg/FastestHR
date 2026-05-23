import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Linkedin, Twitter, Zap, Award, Clock } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { SEO } from '@/components/seo/SEO';
import { AUTHORS, Author } from '@/data/authors';
import { BLOGS, BlogPost } from '@/data/blogs';
import { isSafeUrl } from '@/lib/utils';

const AuthorDetail = () => {
  const { slug } = useParams();
  const [author, setAuthor] = useState<Author | null>(null);
  const [authorPosts, setAuthorPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    const foundAuthor = AUTHORS.find(a => a.slug === slug);
    if (foundAuthor) {
      setAuthor(foundAuthor);
      const posts = BLOGS.filter(b => b.author === foundAuthor.name);
      setAuthorPosts(posts);
    }
    window.scrollTo(0, 0);
  }, [slug]);

  if (!author) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400 font-mono">
        INITIALIZING AUTHOR DATA...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 font-sans selection:bg-cyan-500/30">
      <SEO 
        title={`${author.name} | ${author.title}`}
        description={author.bio}
        type="person"
        person={{
          name: author.name,
          description: author.bio,
          jobTitle: author.title,
          image: author.avatar || undefined,
          sameAs: [
            author.linkedin || '',
            author.twitter || ''
          ].filter(Boolean)
        }}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Intelligence Log', path: '/blog' },
          { name: author.name, path: `/blog/author/${author.slug}` }
        ]}
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

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <section className="relative p-10 rounded-3xl bg-[#0a0a0a] border border-white/5 overflow-hidden mb-16">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            
            <div className="flex flex-col md:flex-row gap-10 items-center md:items-start relative z-10">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 p-1">
                <div className="w-full h-full rounded-[14px] bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                  {author.avatar ? (
                    <img src={author.avatar} alt={author.name} className="w-full h-full object-cover" />
                  ) : (
                    <Zap className="w-12 h-12 text-cyan-400" />
                  )}
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-extrabold tracking-tighter text-white mb-2">{author.name}</h1>
                <p className="text-xl text-cyan-400 font-mono mb-6 uppercase tracking-widest text-sm">{author.title}</p>
                <p className="text-zinc-400 leading-relaxed mb-8 text-lg font-light">
                  {author.bio}
                </p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-6">
                  {author.linkedin && isSafeUrl(author.linkedin) && (
                    <a href={author.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
                      <Linkedin className="w-5 h-5" />
                      <span className="text-sm font-medium">LinkedIn</span>
                    </a>
                  )}
                  {author.twitter && isSafeUrl(author.twitter) && (
                    <a href={author.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
                      <Twitter className="w-5 h-5" />
                      <span className="text-sm font-medium">Twitter</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-12 pt-10 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div>
                <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Expertise & Credentials
                </h3>
                <div className="flex flex-wrap gap-2">
                  {author.credentials?.map((cred, i) => (
                    <span key={i} className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-zinc-300">
                      {cred}
                    </span>
                  ))}
                  <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-zinc-300">
                    {author.experienceYears}+ Years Experience
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Author's Posts */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-8 flex items-center gap-3">
              <Zap className="w-5 h-5 text-cyan-400" /> Transmissions by {author.name}
            </h2>
            
            <div className="grid grid-cols-1 gap-6">
              {authorPosts.length > 0 ? (
                authorPosts.map((post, idx) => (
                  <Link 
                    to={`/blog/${post.slug}`} 
                    key={idx}
                    className="group p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row gap-6 items-center"
                  >
                    <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden bg-zinc-900 border border-white/5">
                      <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">{post.category}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                        <span className="text-xs font-mono text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime}</span>
                      </div>
                      <h3 className="text-xl font-bold text-zinc-200 group-hover:text-white transition-colors mb-2 tracking-tight">
                        {post.title}
                      </h3>
                      <p className="text-zinc-500 text-sm line-clamp-2 font-light">
                        {post.excerpt}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-12 rounded-2xl border border-dashed border-white/10 text-center text-zinc-500">
                  No transmissions archived yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AuthorDetail;
