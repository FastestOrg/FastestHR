import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Upload, Download, Trash2, Search, FolderOpen, Shield, FileCheck, File } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

interface Document {
  id: string;
  name: string;
  category: string;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
  size: string;
  expiresAt?: string;
  filePath?: string;
}

const categories = [
  { value: 'hr_policies', label: 'HR Policies', icon: Shield, color: 'text-primary' },
  { value: 'contracts', label: 'Contracts & NDAs', icon: FileCheck, color: 'text-info' },
  { value: 'employee_docs', label: 'Employee Documents', icon: File, color: 'text-warning' },
  { value: 'templates', label: 'Templates', icon: FileText, color: 'text-success' },
];

export default function Documents() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin' || profile?.platform_role === 'hr_manager';

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'hr_policies', description: '', expiresAt: '' });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [profile?.company_id]);

  const fetchDocuments = async () => {
    if (!profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('company_documents')
        .select(`
          id, name, category, description, file_path, size, expires_at, created_at, created_by
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formatted = (data || []).map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        description: d.description || '',
        uploadedBy: 'System',
        uploadedAt: new Date(d.created_at).toISOString().split('T')[0],
        size: formatSize(d.size),
        expiresAt: d.expires_at ? new Date(d.expires_at).toISOString().split('T')[0] : undefined,
        filePath: d.file_path
      }));
      setDocuments(formatted);
    } catch (err: unknown) {
      toast.error('Failed to load documents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Performance optimization: Hoisted toLowerCase() out of loop to prevent redundant computation
  const lowerSearch = search.toLowerCase();
  const filteredDocs = documents.filter(doc => {
    const matchSearch = doc.name.toLowerCase().includes(lowerSearch);
    const matchCategory = activeTab === 'all' || doc.category === activeTab;
    return matchSearch && matchCategory;
  });

  const getExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const now = new Date();
    const exp = new Date(expiresAt);
    const daysLeft = differenceInDays(exp, now);
    if (daysLeft < 0) return { label: 'Expired', class: 'border-destructive text-destructive bg-destructive/10' };
    if (daysLeft <= 30) return { label: `Expires in ${daysLeft}d`, class: 'border-warning text-warning bg-warning/10' };
    return { label: `Expires: ${expiresAt}`, class: 'border-muted text-muted-foreground' };
  };

  const now = new Date();
  const expiringCount = documents.filter(d => {
    if (!d.expiresAt) return false;
    const exp = new Date(d.expiresAt);
    const daysLeft = differenceInDays(exp, now);
    return daysLeft <= 30;
  }).length;

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Document name is required'); return; }
    if (!file) { toast.error('Please select a file to upload'); return; }
    if (!profile?.company_id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.company_id}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('company_documents')
        .insert({
          company_id: profile.company_id,
          name: form.name,
          category: form.category,
          description: form.description,
          file_path: fileName,
          size: file.size,
          expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          created_by: profile.id
        });

      if (dbError) {
        // Rollback upload
        await supabase.storage.from('documents').remove([fileName]);
        throw dbError;
      }

      toast.success('Document uploaded successfully');
      setDialogOpen(false);
      setForm({ name: '', category: 'hr_policies', description: '', expiresAt: '' });
      setFile(null);
      fetchDocuments();
    } catch (err: unknown) {
      toast.error('Failed to upload document: ' + (err instanceof Error ? err.message : String(err)));
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!doc.filePath || !confirm('Are you sure you want to delete this document?')) return;
    try {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.filePath]);
        
      if (storageError) throw storageError;

      // 2. Delete from DB
      const { error: dbError } = await supabase
        .from('company_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast.success('Document removed');
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: unknown) {
      toast.error('Failed to delete document');
      console.error(err);
    }
  };

  const handleDownload = async (doc: Document) => {
    if (!doc.filePath) return;
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.filePath);
        
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      // Extract original file extension from filePath if possible, or just use name
      const ext = doc.filePath.split('.').pop() || '';
      const downloadName = doc.name.endsWith(`.${ext}`) ? doc.name : `${doc.name}.${ext}`;
      
      a.download = downloadName.replace(/\s+/g, '_').toLowerCase();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloading ${doc.name}...`);
    } catch (err: unknown) {
      toast.error('Failed to download document');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
          <p className="text-muted-foreground mt-1">
            HR policies, contracts & company documents
            {expiringCount > 0 && <Badge variant="outline" className="ml-2 border-warning text-warning text-[10px]">{expiringCount} expiring/expired</Badge>}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Upload className="h-4 w-4" /> Upload Document</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>Add a new document to the company repository</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Document Name</Label>
                  <Input placeholder="e.g., Employee Handbook 2026" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Brief description..." rows={2} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date (optional)</Label>
                  <Input type="date" value={form.expiresAt} onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
                </div>
                <div className="relative border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <FileText className="w-8 h-8 text-primary/60 mx-auto mb-2" />
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="pointer-events-none">
                      <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOCX, XLSX up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={uploading}>Cancel</Button>
                <Button onClick={handleCreate} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Document'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {categories.map(cat => {
          const count = documents.filter(d => d.category === cat.value).length;
          return (
            <Card key={cat.value} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab(cat.value)}>
              <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-lg bg-background border border-border/50 ${cat.color} flex-shrink-0`}>
                  <cat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold truncate max-w-[80px] sm:max-w-none">{cat.label}</p>
                  <p className="text-xl sm:text-2xl font-black">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter & Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search documents..." className="pl-9 w-full bg-background/50 border-border/50 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="w-full overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex w-max sm:w-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
            {categories.map(c => (
              <TabsTrigger key={c.value} value={c.value} className="text-xs sm:text-sm">{c.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="flex justify-center items-center py-12">
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              </CardContent>
            </Card>
          ) : filteredDocs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No documents found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map(doc => (
                <Card key={doc.id} className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3 w-full">
                      <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-foreground text-sm truncate">{doc.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          <span>{doc.uploadedBy}</span>
                          <span>&bull;</span>
                          <span>{doc.uploadedAt}</span>
                          <span>&bull;</span>
                          <span>{doc.size}</span>
                          {doc.expiresAt && (() => {
                            const status = getExpiryStatus(doc.expiresAt);
                            return status ? (
                              <>
                                <span>&bull;</span>
                                <Badge variant="outline" className={`text-[8px] uppercase font-bold tracking-tight py-0 px-1.5 ${status.class}`}>{status.label}</Badge>
                              </>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg" onClick={() => handleDownload(doc)} aria-label="Download document">
                        <Download className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(doc)} aria-label="Delete document">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
