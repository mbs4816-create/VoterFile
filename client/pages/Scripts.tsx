import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { FileText, Plus, Edit, Trash2, Copy, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface ScriptQuestion {
  id: string;
  text: string;
  type: 'text' | 'single' | 'multiple';
  options?: string[];
  required: boolean;
}

interface Script {
  id: number;
  name: string;
  type: 'phone' | 'canvass';
  content: string;
  questions: ScriptQuestion[];
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export function Scripts() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [expandedScripts, setExpandedScripts] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({
    name: '',
    type: 'phone' as 'phone' | 'canvass',
    content: '',
    questions: [] as ScriptQuestion[],
    isActive: true,
  });

  const { data: scriptsData, isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => apiGet<{ success: boolean; data: Script[] }>('/scripts'),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiPost('/scripts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setShowCreate(false);
      resetForm();
      toast({ title: 'Script created', description: 'Your script is ready to use.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create script.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) => apiPatch(`/scripts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setEditingScript(null);
      resetForm();
      toast({ title: 'Script updated', description: 'Changes have been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update script.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/scripts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      toast({ title: 'Script deleted', description: 'The script has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete script.', variant: 'destructive' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/scripts/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      toast({ title: 'Script duplicated', description: 'A copy has been created.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to duplicate script.', variant: 'destructive' });
    },
  });

  const scripts = scriptsData?.data || [];

  const resetForm = () => {
    setForm({
      name: '',
      type: 'phone',
      content: '',
      questions: [],
      isActive: true,
    });
  };

  const openEdit = (script: Script) => {
    setEditingScript(script);
    setForm({
      name: script.name,
      type: script.type,
      content: script.content,
      questions: script.questions,
      isActive: script.isActive,
    });
  };

  const addQuestion = () => {
    setForm({
      ...form,
      questions: [
        ...form.questions,
        {
          id: `q-${Date.now()}`,
          text: '',
          type: 'single',
          options: ['Yes', 'No', 'Undecided'],
          required: false,
        },
      ],
    });
  };

  const updateQuestion = (index: number, updates: Partial<ScriptQuestion>) => {
    const newQuestions = [...form.questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setForm({ ...form, questions: newQuestions });
  };

  const removeQuestion = (index: number) => {
    setForm({
      ...form,
      questions: form.questions.filter((_, i) => i !== index),
    });
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedScripts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedScripts(newExpanded);
  };

  const ScriptDialog = ({ isEdit }: { isEdit: boolean }) => (
    <Dialog open={isEdit ? !!editingScript : showCreate} onOpenChange={(open) => {
      if (isEdit) setEditingScript(open ? editingScript : null);
      else setShowCreate(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Script' : 'Create Script'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Make changes to your script.' : 'Create a new script for phone banking or canvassing.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Script Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Voter ID Script"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as 'phone' | 'canvass' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone Banking</SelectItem>
                  <SelectItem value="canvass">Canvassing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Script Content</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Hi, my name is {{volunteer_name}} and I'm calling on behalf of {{campaign}}. Is {{voter_name}} available?

[Wait for response]

Thank you for taking my call! ..."
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{voter_name}}"}, {"{{volunteer_name}}"}, {"{{campaign}}"} for personalization.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Survey Questions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-1" />
                Add Question
              </Button>
            </div>

            {form.questions.map((question, index) => (
              <Card key={question.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <Input
                            value={question.text}
                            onChange={(e) => updateQuestion(index, { text: e.target.value })}
                            placeholder="Question text"
                          />
                        </div>
                        <Select
                          value={question.type}
                          onValueChange={(v) => updateQuestion(index, { type: v as ScriptQuestion['type'] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single Choice</SelectItem>
                            <SelectItem value="multiple">Multiple Choice</SelectItem>
                            <SelectItem value="text">Free Text</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(question.type === 'single' || question.type === 'multiple') && (
                        <div className="space-y-2">
                          <Label className="text-xs">Options (one per line)</Label>
                          <Textarea
                            value={question.options?.join('\n') || ''}
                            onChange={(e) => updateQuestion(index, { options: e.target.value.split('\n') })}
                            placeholder="Yes&#10;No&#10;Undecided"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="isActive">Active (available for use)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            if (isEdit) setEditingScript(null);
            else setShowCreate(false);
            resetForm();
          }}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (isEdit && editingScript) {
                updateMutation.mutate({ id: editingScript.id, data: form });
              } else {
                createMutation.mutate(form);
              }
            }}
            disabled={!form.name || !form.content || (isEdit ? updateMutation.isPending : createMutation.isPending)}
          >
            {isEdit ? 'Save Changes' : 'Create Script'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Scripts
          </h1>
          <p className="text-muted-foreground">
            Manage scripts for phone banking and canvassing
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Script
        </Button>
      </div>

      {/* Scripts List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading scripts...</div>
      ) : scripts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No scripts yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first script for phone banking or canvassing.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Script
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scripts.map(script => (
            <Card key={script.id}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleExpand(script.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {expandedScripts.has(script.id) ? (
                      <ChevronDown className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{script.name}</CardTitle>
                      <CardDescription>
                        {script.type === 'phone' ? 'Phone Banking' : 'Canvassing'} • {script.questions.length} questions
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {script.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedScripts.has(script.id) && (
                <CardContent className="pt-4 border-t">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Script Content</h4>
                      <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                        {script.content}
                      </div>
                    </div>

                    {script.questions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Survey Questions</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Question</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Options</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {script.questions.map((q, i) => (
                              <TableRow key={q.id}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>{q.text}</TableCell>
                                <TableCell className="capitalize">{q.type}</TableCell>
                                <TableCell>
                                  {q.options?.slice(0, 3).join(', ')}
                                  {q.options && q.options.length > 3 && ` +${q.options.length - 3} more`}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm text-muted-foreground">
                        Used {script.usageCount} times • Updated {formatDate(script.updatedAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate(script.id)}>
                          <Copy className="h-4 w-4 mr-1" />
                          Duplicate
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(script)}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this script?')) {
                              deleteMutation.mutate(script.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <ScriptDialog isEdit={false} />
      <ScriptDialog isEdit={true} />
    </div>
  );
}
