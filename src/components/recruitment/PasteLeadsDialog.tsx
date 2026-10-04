import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  ClipboardPaste,
  ArrowUpDown,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Loader2,
  X,
  Linkedin,
  Mail,
  Phone,
  User,
  Star,
  FileText,
  Tag,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import {
  TargetField,
  TARGET_FIELDS,
  parseExcelClipboard,
  transposeGrid,
  detectIfFirstRowIsHeader,
  autoDetectColumnMappings,
  validateRow,
  getColumnLetter,
  SAMPLE_EXCEL_CLIPBOARD,
} from '@/lib/excel-clipboard';

interface PasteLeadsDialogProps {
  jobId?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialClipboardText?: string;
}

export function PasteLeadsDialog({
  jobId,
  isOpen,
  onOpenChange,
  initialClipboardText,
}: PasteLeadsDialogProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const [grid, setGrid] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [columnMappings, setColumnMappings] = useState<TargetField[]>([]);
  const [targetJobId, setTargetJobId] = useState<string>(jobId || '');
  const [defaultSource, setDefaultSource] = useState<string>('excel_import');
  const [manualText, setManualText] = useState<string>('');
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);

  // Sync targetJobId when jobId prop changes
  useEffect(() => {
    if (jobId) {
      setTargetJobId(jobId);
    }
  }, [jobId]);

  // Fetch available jobs for company so the user can verify or pick target job
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-paste', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!profile?.company_id,
  });

  // If no job selected and jobs exist, default to first job
  useEffect(() => {
    if (!targetJobId && jobs.length > 0) {
      setTargetJobId(jobs[0].id);
    }
  }, [jobs, targetJobId]);

  // Load raw text into grid
  const loadTextIntoGrid = (text: string) => {
    const parsed = parseExcelClipboard(text);
    if (parsed.length === 0) {
      toast.error('No tabular or cell data detected in pasted text.');
      return;
    }

    const isHeader = detectIfFirstRowIsHeader(parsed);
    setHasHeader(isHeader);
    const mappings = autoDetectColumnMappings(parsed, isHeader);
    setGrid(parsed);
    setColumnMappings(mappings);
    setManualText('');
    toast.success(`Loaded ${isHeader ? parsed.length - 1 : parsed.length} rows from clipboard`);
  };

  // When initialClipboardText is provided on open
  useEffect(() => {
    if (isOpen && initialClipboardText) {
      loadTextIntoGrid(initialClipboardText);
    }
  }, [isOpen, initialClipboardText]);

  // Native clipboard reader button
  const handlePasteFromClipboard = async () => {
    setIsReadingClipboard(true);
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('Clipboard API not supported in this browser context');
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast.info('Clipboard is currently empty. Please copy cells from Excel or Google Sheets first.');
        return;
      }
      loadTextIntoGrid(text);
    } catch (err: any) {
      console.warn('Clipboard read error:', err);
      toast.info('Clipboard auto-read restricted. Please press Ctrl+V inside the paste box below.');
    } finally {
      setIsReadingClipboard(false);
    }
  };

  // Load sample demo data
  const handleLoadSample = () => {
    loadTextIntoGrid(SAMPLE_EXCEL_CLIPBOARD);
  };

  // Toggle "first row is header"
  const handleToggleHeader = (checked: boolean) => {
    setHasHeader(checked);
    if (grid.length > 0) {
      const newMappings = autoDetectColumnMappings(grid, checked);
      setColumnMappings(newMappings);
    }
  };

  // Transpose rows and columns
  const handleTranspose = () => {
    if (grid.length === 0) return;
    const transposed = transposeGrid(grid);
    const isHeader = detectIfFirstRowIsHeader(transposed);
    setHasHeader(isHeader);
    const mappings = autoDetectColumnMappings(transposed, isHeader);
    setGrid(transposed);
    setColumnMappings(mappings);
    toast.info('Swapped rows and columns (Transposed)');
  };

  // Add an empty row
  const handleAddRow = () => {
    const numCols = grid.length > 0 ? grid[0].length : Math.max(columnMappings.length, 3);
    const emptyRow = new Array(numCols).fill('');
    setGrid([...grid, emptyRow]);
  };

  // Add a new column
  const handleAddColumn = () => {
    const updatedGrid = grid.map(row => [...row, '']);
    setGrid(updatedGrid);
    setColumnMappings([...columnMappings, 'none']);
  };

  // Delete a specific row
  const handleDeleteRow = (rowIndex: number) => {
    const updated = grid.filter((_, idx) => idx !== rowIndex);
    setGrid(updated);
  };

  // Delete a specific column
  const handleDeleteColumn = (colIndex: number) => {
    const updatedGrid = grid.map(row => row.filter((_, idx) => idx !== colIndex));
    const updatedMappings = columnMappings.filter((_, idx) => idx !== colIndex);
    setGrid(updatedGrid);
    setColumnMappings(updatedMappings);
  };

  // Update a single cell value
  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const updated = grid.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const newRow = [...row];
      newRow[colIndex] = value;
      return newRow;
    });
    setGrid(updated);
  };

  // Update column mapping
  const handleMappingChange = (colIndex: number, field: TargetField) => {
    const updated = [...columnMappings];
    updated[colIndex] = field;
    setColumnMappings(updated);
  };

  // Clear everything
  const handleClear = () => {
    setGrid([]);
    setColumnMappings([]);
    setManualText('');
  };

  // Data rows depending on whether row 0 is header
  const dataRows = useMemo(() => {
    if (grid.length === 0) return [];
    return hasHeader ? grid.slice(1) : grid;
  }, [grid, hasHeader]);

  // Find column indices for key fields
  const nameColIdx = columnMappings.indexOf('full_name');
  const emailColIdx = columnMappings.indexOf('email');
  const phoneColIdx = columnMappings.indexOf('phone');
  const linkedinColIdx = columnMappings.indexOf('linkedin');
  const sourceColIdx = columnMappings.indexOf('source');
  const scoreColIdx = columnMappings.indexOf('score');
  const notesColIdx = columnMappings.indexOf('recruiter_notes');

  // Row validation results
  const rowValidations = useMemo(() => {
    return dataRows.map(row => validateRow(row, nameColIdx, emailColIdx));
  }, [dataRows, nameColIdx, emailColIdx]);

  const validRowCount = useMemo(() => {
    return rowValidations.filter(v => v.isValid).length;
  }, [rowValidations]);

  const invalidRowCount = useMemo(() => {
    return rowValidations.filter(v => !v.isValid).length;
  }, [rowValidations]);

  // Mutation to insert leads into Supabase
  const mutation = useMutation({
    mutationFn: async () => {
      if (!targetJobId) {
        throw new Error('Please select a target job');
      }
      if (!profile?.company_id) {
        throw new Error('Missing company profile');
      }
      if (nameColIdx === -1 || emailColIdx === -1) {
        throw new Error('Please map both Full Name and Email Address columns');
      }

      // Filter only rows that have valid Full Name and Email
      const candidatesToInsert = dataRows
        .map(row => {
          const fullName = (row[nameColIdx] || '').trim();
          const email = (row[emailColIdx] || '').trim();
          if (!fullName || !email) return null;

          const phone = phoneColIdx >= 0 ? (row[phoneColIdx] || '').trim() : null;
          const linkedin = linkedinColIdx >= 0 ? (row[linkedinColIdx] || '').trim() : null;
          const scoreRaw = scoreColIdx >= 0 ? (row[scoreColIdx] || '').trim() : null;
          const score = scoreRaw && !isNaN(Number(scoreRaw)) 
            ? Math.min(10, Math.max(0, parseFloat(scoreRaw))) 
            : null;
          const notes = notesColIdx >= 0 ? (row[notesColIdx] || '').trim() : null;
          const rowSource = sourceColIdx >= 0 ? (row[sourceColIdx] || '').trim() : null;

          // Extra fields stored in parsed_data
          const extraData: Record<string, any> = {};
          if (linkedin) extraData.linkedin = linkedin;
          if (notes) extraData.notes = notes;

          // Capture other unmapped column values if present
          columnMappings.forEach((mapping, colIdx) => {
            if (mapping === 'none' && row[colIdx] && row[colIdx].trim()) {
              const headerTitle = hasHeader && grid[0]?.[colIdx]
                ? grid[0][colIdx].trim()
                : `col_${getColumnLetter(colIdx)}`;
              extraData[headerTitle] = row[colIdx].trim();
            }
          });

          return {
            job_id: targetJobId,
            company_id: profile.company_id,
            full_name: fullName,
            email: email,
            phone: phone || null,
            source: rowSource || defaultSource || 'excel_import',
            stage: 'applied',
            score: score,
            recruiter_notes: notes || null,
            parsed_data: extraData,
            assigned_to: profile.id,
            assigned_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (candidatesToInsert.length === 0) {
        throw new Error('No valid candidates found to insert. Check that Full Name and Email are filled.');
      }

      const { data, error } = await supabase
        .from('candidates')
        .insert(candidatesToInsert as any)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const count = data?.length || validRowCount;
      queryClient.invalidateQueries({ queryKey: ['candidates', targetJobId] });
      queryClient.invalidateQueries({ queryKey: ['leads-board'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', profile?.company_id] });
      toast.success(`✦ Added ${count} lead${count > 1 ? 's' : ''} to pipeline!`);
      handleClose();
    },
    onError: (err: any) => {
      console.error('Error inserting leads:', err);
      toast.error(err.message || 'Failed to add leads. Please check your data.');
    },
  });

  const handleClose = () => {
    setGrid([]);
    setColumnMappings([]);
    setManualText('');
    onOpenChange(false);
  };

  const getFieldIcon = (fieldId: TargetField) => {
    switch (fieldId) {
      case 'full_name': return <User className="h-3 w-3 text-blue-500" />;
      case 'email': return <Mail className="h-3 w-3 text-emerald-500" />;
      case 'phone': return <Phone className="h-3 w-3 text-amber-500" />;
      case 'linkedin': return <Linkedin className="h-3 w-3 text-[#0A66C2]" />;
      case 'score': return <Star className="h-3 w-3 text-yellow-500" />;
      case 'source': return <Tag className="h-3 w-3 text-purple-500" />;
      case 'recruiter_notes': return <FileText className="h-3 w-3 text-indigo-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-2xl border-border/60 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/10 bg-muted/20">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    Paste Leads from Excel / Clipboard
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                      Excel Grid
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Copy cells from Excel, Google Sheets, or CSV and paste directly. Edit any cell, map columns, and add to your pipeline.
                  </DialogDescription>
                </div>
              </div>

              {/* Target Job Selector */}
              <div className="flex items-center gap-2 ml-auto">
                <Label htmlFor="target-job" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                  <Briefcase className="h-3.5 w-3.5 text-primary" /> Target Position:
                </Label>
                <Select value={targetJobId} onValueChange={setTargetJobId}>
                  <SelectTrigger id="target-job" className="h-8 min-w-[180px] max-w-[240px] text-xs font-medium bg-background/80">
                    <SelectValue placeholder="Select target job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id} className="text-xs font-medium">
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {grid.length === 0 ? (
            /* Empty State / Paste Dropzone */
            <div className="space-y-6">
              <div
                className="group relative border-2 border-dashed border-border/60 hover:border-emerald-500/60 hover:bg-emerald-500/5 rounded-2xl p-10 transition-all duration-300 flex flex-col items-center justify-center text-center space-y-4 cursor-pointer"
                onClick={handlePasteFromClipboard}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData?.getData('text/plain') || '';
                  if (pastedText) loadTextIntoGrid(pastedText);
                }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                    // Let native paste trigger
                  }
                }}
              >
                <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <ClipboardPaste className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Click to Paste from Clipboard</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border/80 text-[11px] font-mono font-bold">Ctrl + V</kbd> or click anywhere in this box to paste your copied Excel or Sheets cells.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20"
                    disabled={isReadingClipboard}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePasteFromClipboard();
                    }}
                  >
                    {isReadingClipboard ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardPaste className="h-4 w-4" />
                    )}
                    Paste Clipboard
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl border-dashed"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSample();
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Try with Demo Data
                  </Button>
                </div>
              </div>

              {/* Manual fallback input area */}
              <div className="space-y-2 border border-border/40 rounded-xl p-4 bg-muted/10">
                <Label htmlFor="manual-paste-text" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Or manually paste TSV / CSV text below:</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Tab or comma separated</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-paste-text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="e.g. John Doe	john@example.com	+123456789	https://linkedin.com/in/john"
                    className="text-xs font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualText.trim()) {
                        e.preventDefault();
                        loadTextIntoGrid(manualText);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!manualText.trim()}
                    onClick={() => loadTextIntoGrid(manualText)}
                    className="rounded-lg text-xs"
                  >
                    Load
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Excel Interactive Spreadsheet Table */
            <div className="space-y-4">
              {/* Spreadsheet Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border border-border/50 backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-4">
                  {/* First row is header switch */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="first-row-header"
                      checked={hasHeader}
                      onCheckedChange={handleToggleHeader}
                    />
                    <Label htmlFor="first-row-header" className="text-xs font-medium cursor-pointer">
                      First row is header
                    </Label>
                  </div>

                  <div className="h-4 w-px bg-border/60" />

                  {/* Transpose button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTranspose}
                    className="h-7 text-xs gap-1.5 rounded-lg hover:bg-primary/5"
                    title="Swap rows and columns"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                    Transpose Rows/Cols
                  </Button>

                  {/* Add Row button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRow}
                    className="h-7 text-xs gap-1.5 rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                  </Button>

                  {/* Add Column button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddColumn}
                    className="h-7 text-xs gap-1.5 rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Col
                  </Button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive rounded-lg"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear & Re-paste
                  </Button>
                </div>
              </div>

              {/* Status Warning if required fields not mapped */}
              {(nameColIdx === -1 || emailColIdx === -1) && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-medium animate-in fade-in duration-200">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Action required: Please map at least the <strong className="font-bold underline">Full Name *</strong> and <strong className="font-bold underline">Email Address *</strong> columns using the dropdown headers below.
                  </span>
                </div>
              )}

              {/* Excel Table Container */}
              <div className="border border-border/60 rounded-xl overflow-x-auto max-h-[380px] bg-background shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  {/* Column Header Dropdowns */}
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-md z-10 border-b border-border/60">
                    <tr>
                      {/* Row number / status column */}
                      <th className="p-2 w-14 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border/40 bg-muted/60">
                        #
                      </th>
                      {/* Column mapping headers */}
                      {columnMappings.map((mapping, colIdx) => (
                        <th
                          key={colIdx}
                          className="p-2 min-w-[200px] border-r border-border/40 last:border-r-0"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">
                                  Col {getColumnLetter(colIdx)}
                                </span>
                                {hasHeader && grid[0]?.[colIdx] && (
                                  <span className="text-foreground truncate max-w-[120px]" title={grid[0][colIdx]}>
                                    "{grid[0][colIdx]}"
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(colIdx)}
                                className="text-muted-foreground/60 hover:text-destructive transition-colors p-0.5"
                                title="Remove column"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Mapping Select */}
                            <Select
                              value={mapping}
                              onValueChange={(val) => handleMappingChange(colIdx, val as TargetField)}
                            >
                              <SelectTrigger className={`h-8 text-xs font-semibold rounded-lg ${
                                mapping === 'full_name' || mapping === 'email'
                                  ? 'border-primary/50 bg-primary/5 text-primary'
                                  : mapping === 'linkedin'
                                  ? 'border-blue-500/40 bg-blue-500/5 text-blue-600 dark:text-blue-400'
                                  : mapping !== 'none'
                                  ? 'border-border bg-background'
                                  : 'text-muted-foreground border-dashed'
                              }`}>
                                <div className="flex items-center gap-1.5 truncate">
                                  {getFieldIcon(mapping)}
                                  <SelectValue placeholder="Map to field..." />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {TARGET_FIELDS.map((f) => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <span className="flex items-center gap-2 font-medium">
                                        {getFieldIcon(f.id)}
                                        {f.label}
                                      </span>
                                      {f.required && (
                                        <span className="text-[10px] text-destructive font-bold uppercase">
                                          Req
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </th>
                      ))}
                      <th className="p-2 w-10 text-center text-muted-foreground"></th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-border/30 font-sans">
                    {/* Header Row display (if enabled) */}
                    {hasHeader && grid.length > 0 && (
                      <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors border-b border-emerald-500/20">
                        <td className="p-2 text-center border-r border-border/40 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                          Hdr
                        </td>
                        {grid[0].map((cell, colIdx) => (
                          <td key={colIdx} className="p-1.5 border-r border-border/40 last:border-r-0">
                            <Input
                              value={cell}
                              onChange={(e) => handleCellChange(0, colIdx, e.target.value)}
                              placeholder={`Header ${getColumnLetter(colIdx)}`}
                              className="h-7 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border-none bg-transparent hover:bg-background/60 focus:bg-background shadow-none px-2 rounded"
                            />
                          </td>
                        ))}
                        <td className="p-2 text-center"></td>
                      </tr>
                    )}

                    {/* Data Rows */}
                    {dataRows.map((row, rIdx) => {
                      const actualRowIndex = hasHeader ? rIdx + 1 : rIdx;
                      const validation = rowValidations[rIdx] || { isValid: true, errors: [] };

                      return (
                        <tr
                          key={actualRowIndex}
                          className={`group hover:bg-muted/30 transition-colors ${
                            !validation.isValid ? 'bg-destructive/5' : ''
                          }`}
                        >
                          {/* Row Number & Validation Status */}
                          <td className="p-2 text-center border-r border-border/40 font-mono text-[11px] text-muted-foreground select-none relative bg-muted/10">
                            <div className="flex items-center justify-center gap-1">
                              <span>{actualRowIndex + 1}</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      {validation.isValid ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <AlertTriangle className="h-3 w-3 text-amber-500 animate-pulse" />
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="text-xs">
                                    {validation.isValid ? (
                                      'Valid candidate row'
                                    ) : (
                                      <ul className="list-disc pl-3 space-y-0.5">
                                        {validation.errors.map((err, eIdx) => (
                                          <li key={eIdx}>{err}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </td>

                          {/* Editable Cells */}
                          {row.map((cell, colIdx) => (
                            <td key={colIdx} className="p-1 border-r border-border/30 last:border-r-0">
                              <Input
                                value={cell}
                                onChange={(e) => handleCellChange(actualRowIndex, colIdx, e.target.value)}
                                placeholder="—"
                                className="h-8 text-xs border-transparent hover:border-border/60 focus:border-primary/60 bg-transparent hover:bg-background/80 focus:bg-background shadow-none px-2 rounded font-sans transition-all"
                              />
                            </td>
                          ))}

                          {/* Delete row action */}
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(actualRowIndex)}
                              className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded"
                              title="Delete row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mapping & Import Summary Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1.5 py-1 px-2.5 rounded-lg bg-muted/40 font-medium">
                    <span>Total Rows:</span>
                    <strong className="text-foreground">{dataRows.length}</strong>
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`gap-1.5 py-1 px-2.5 rounded-lg font-medium ${
                      validRowCount > 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-muted/40'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Valid to import:</span>
                    <strong>{validRowCount}</strong>
                  </Badge>

                  {invalidRowCount > 0 && (
                    <Badge variant="outline" className="gap-1.5 py-1 px-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Incomplete (will be skipped):</span>
                      <strong>{invalidRowCount}</strong>
                    </Badge>
                  )}
                </div>

                {/* Candidate source input */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="lead-source" className="text-xs text-muted-foreground whitespace-nowrap">
                    Lead Source:
                  </Label>
                  <Input
                    id="lead-source"
                    value={defaultSource}
                    onChange={(e) => setDefaultSource(e.target.value)}
                    placeholder="e.g. excel_import"
                    className="h-7 w-32 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/10 bg-muted/30 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="rounded-xl px-4"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            {grid.length > 0 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={
                  mutation.isPending ||
                  validRowCount === 0 ||
                  nameColIdx === -1 ||
                  emailColIdx === -1 ||
                  !targetJobId
                }
                className="gap-2 rounded-xl px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing leads...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add {validRowCount} Lead{validRowCount !== 1 ? 's' : ''} to Pipeline
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
