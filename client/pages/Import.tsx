import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { toast } from '../hooks/useToast';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

interface ImportPreview {
  totalRows: number;
  sampleData: Record<string, string>[];
  sourceColumns: string[];
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const TARGET_FIELDS = [
  { value: 'stateVoterId', label: 'State Voter ID', required: true },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'middleName', label: 'Middle Name' },
  { value: 'suffix', label: 'Suffix' },
  { value: 'dateOfBirth', label: 'Date of Birth' },
  { value: 'gender', label: 'Gender' },
  { value: 'address', label: 'Street Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zip', label: 'ZIP Code' },
  { value: 'county', label: 'County' },
  { value: 'precinct', label: 'Precinct' },
  { value: 'congressionalDistrict', label: 'Congressional District' },
  { value: 'stateSenateDistrict', label: 'State Senate District' },
  { value: 'stateHouseDistrict', label: 'State House District' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'partyAffiliation', label: 'Party' },
  { value: 'registrationDate', label: 'Registration Date' },
  { value: 'registrationStatus', label: 'Registration Status' },
  { value: 'latitude', label: 'Latitude' },
  { value: 'longitude', label: 'Longitude' },
  { value: 'skip', label: '— Skip this column —' },
];

export function Import() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update'>('update');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      setPreview(data.data);
      // Auto-map columns based on name similarity
      const autoMappings = data.data.sourceColumns.map((col: string) => {
        const normalizedCol = col.toLowerCase().replace(/[^a-z]/g, '');
        const match = TARGET_FIELDS.find(f => {
          const normalizedField = f.value.toLowerCase();
          return normalizedCol.includes(normalizedField) || normalizedField.includes(normalizedCol);
        });
        return {
          sourceColumn: col,
          targetField: match?.value || 'skip',
        };
      });
      setMappings(autoMappings);
      setStep('mapping');
    },
    onError: () => {
      toast({ title: 'Upload failed', description: 'Could not process the file.', variant: 'destructive' });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('file', file!);
      formData.append('mappings', JSON.stringify(mappings));
      formData.append('duplicateHandling', duplicateHandling);
      const response = await fetch('/api/import/voters', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
    onSuccess: (data) => {
      setImportResult(data.data);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['voters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => {
      toast({ title: 'Import failed', description: 'Could not import voters.', variant: 'destructive' });
      setStep('preview');
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      uploadMutation.mutate(selectedFile);
    }
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.txt'))) {
      setFile(droppedFile);
      uploadMutation.mutate(droppedFile);
    }
  }, [uploadMutation]);

  const updateMapping = (index: number, targetField: string) => {
    const newMappings = [...mappings];
    newMappings[index].targetField = targetField;
    setMappings(newMappings);
  };

  const hasRequiredMappings = mappings.some(m => m.targetField === 'stateVoterId');

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setMappings([]);
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Upload className="h-8 w-8" />
          Import Voters
        </h1>
        <p className="text-muted-foreground">
          Upload voter files to add or update voter records
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 py-4">
        {(['upload', 'mapping', 'preview', 'complete'] as const).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : i < ['upload', 'mapping', 'preview', 'complete'].indexOf(step)
                  ? 'bg-green-600 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < ['upload', 'mapping', 'preview', 'complete'].indexOf(step) ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className={`ml-2 text-sm ${step === s ? 'font-medium' : 'text-muted-foreground'}`}>
              {s === 'upload' && 'Upload'}
              {s === 'mapping' && 'Map Columns'}
              {s === 'preview' && 'Review'}
              {s === 'complete' && 'Complete'}
            </span>
            {i < 3 && <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Voter File</CardTitle>
            <CardDescription>
              Upload a CSV or tab-delimited file containing voter records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              {uploadMutation.isPending ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                  <p>Processing file...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">Drop your file here</p>
                    <p className="text-muted-foreground">or click to browse</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Supports CSV and tab-delimited files up to 2GB
                  </p>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Supported File Formats</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Minnesota State Voter File (District##_Unified.csv)</li>
                <li>• VoteBuilder/VAN Export</li>
                <li>• L2 Data Export</li>
                <li>• Custom CSV with State Voter ID column</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Match your file columns to VoterPulse fields. Required fields are marked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(preview.totalRows)} rows • {preview.sourceColumns.length} columns
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mappings.map((mapping, index) => (
                <div key={mapping.sourceColumn} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Source Column</Label>
                    <div className="font-mono text-sm p-2 bg-muted rounded">
                      {mapping.sourceColumn}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">VoterPulse Field</Label>
                    <Select
                      value={mapping.targetField}
                      onValueChange={(v) => updateMapping(index, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_FIELDS.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                            {field.required && ' *'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {!hasRequiredMappings && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">
                  You must map a column to "State Voter ID" to continue.
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetImport}>
                Start Over
              </Button>
              <Button onClick={() => setStep('preview')} disabled={!hasRequiredMappings}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Review Import</CardTitle>
            <CardDescription>
              Verify your settings before importing voters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold">{formatNumber(preview.totalRows)}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold">
                  {mappings.filter(m => m.targetField !== 'skip').length}
                </p>
                <p className="text-sm text-muted-foreground">Mapped Columns</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold">
                  {mappings.filter(m => m.targetField === 'skip').length}
                </p>
                <p className="text-sm text-muted-foreground">Skipped Columns</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Duplicate Handling</Label>
              <Select value={duplicateHandling} onValueChange={(v) => setDuplicateHandling(v as 'skip' | 'update')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">Update existing records</SelectItem>
                  <SelectItem value="skip">Skip duplicates</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Duplicates are identified by State Voter ID
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sample Data Preview</Label>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      {mappings.filter(m => m.targetField !== 'skip').slice(0, 6).map(m => (
                        <th key={m.sourceColumn} className="px-4 py-2 text-left">
                          {TARGET_FIELDS.find(f => f.value === m.targetField)?.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {mappings.filter(m => m.targetField !== 'skip').slice(0, 6).map(m => (
                          <td key={m.sourceColumn} className="px-4 py-2 truncate max-w-[200px]">
                            {row[m.sourceColumn] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={() => {
                setStep('importing');
                importMutation.mutate();
              }}>
                Start Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-bold mb-2">Importing Voters</h2>
            <p className="text-muted-foreground">
              This may take several minutes for large files. Please don't close this page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Complete Step */}
      {step === 'complete' && importResult && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-6" />
            <h2 className="text-2xl font-bold mb-2">Import Complete</h2>
            <p className="text-muted-foreground mb-8">
              Your voter file has been processed successfully.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">{formatNumber(importResult.imported)}</p>
                <p className="text-sm text-green-600">Imported</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-700">{formatNumber(importResult.updated)}</p>
                <p className="text-sm text-blue-600">Updated</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-700">{formatNumber(importResult.skipped)}</p>
                <p className="text-sm text-yellow-600">Skipped</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-w-md mx-auto mb-8">
                <div className="p-4 bg-red-50 rounded-lg text-left">
                  <p className="font-medium text-red-800 mb-2">
                    {importResult.errors.length} errors occurred:
                  </p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {importResult.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>• ...and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={resetImport}>
                Import Another File
              </Button>
              <Button onClick={() => window.location.href = '/voters'}>
                View Voters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
