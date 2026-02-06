import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Upload, Wand2, GripVertical, Loader2 } from 'lucide-react';
import type { CampaignType, CampaignQuestion } from '@/lib/supabase-types';

interface StepQuestionsProps {
  campaignType: CampaignType;
  questions: CampaignQuestion[];
  onChange: (questions: CampaignQuestion[]) => void;
}

const questionTypeLabels: Record<CampaignQuestion['type'], string> = {
  rating: 'Star Rating (1-5)',
  scale: 'Scale (1-10)',
  multiple_choice: 'Multiple Choice',
  text: 'Free Text',
  nps: 'NPS Score (0-10)',
};

const suggestedQuestions: Record<CampaignType, CampaignQuestion[]> = {
  feedback: [
    { id: '1', type: 'scale', question: 'How satisfied are you with our overall service?', required: true, min: 1, max: 10 },
    { id: '2', type: 'rating', question: 'How would you rate the quality of our service?', required: true },
    { id: '3', type: 'nps', question: 'How likely are you to recommend us to others?', required: true },
    { id: '4', type: 'multiple_choice', question: 'What areas need improvement?', required: false, options: ['Communication', 'Response Time', 'Product Quality', 'Customer Service', 'Pricing'] },
    { id: '5', type: 'text', question: 'Any additional comments or suggestions?', required: false },
  ],
  employee_survey: [
    { id: '1', type: 'scale', question: 'How satisfied are you with your current role?', required: true, min: 1, max: 10 },
    { id: '2', type: 'rating', question: 'How would you rate work-life balance?', required: true },
    { id: '3', type: 'nps', question: 'How likely are you to recommend working here?', required: true },
    { id: '4', type: 'multiple_choice', question: 'What would improve your experience?', required: false, options: ['Better Communication', 'Career Growth', 'Work Environment', 'Compensation', 'Management'] },
    { id: '5', type: 'text', question: 'Share any additional feedback...', required: false },
  ],
  product_research: [
    { id: '1', type: 'scale', question: 'How useful is this product/feature?', required: true, min: 1, max: 10 },
    { id: '2', type: 'rating', question: 'How easy is the product to use?', required: true },
    { id: '3', type: 'nps', question: 'How likely are you to continue using this product?', required: true },
    { id: '4', type: 'multiple_choice', question: 'What features matter most?', required: false, options: ['Performance', 'Design', 'Price', 'Support', 'Integration'] },
    { id: '5', type: 'text', question: 'What features would you like to see?', required: false },
  ],
  event_evaluation: [
    { id: '1', type: 'scale', question: 'How would you rate the event overall?', required: true, min: 1, max: 10 },
    { id: '2', type: 'rating', question: 'How useful was the content presented?', required: true },
    { id: '3', type: 'nps', question: 'How likely are you to attend future events?', required: true },
    { id: '4', type: 'multiple_choice', question: 'What aspects worked well?', required: false, options: ['Speakers', 'Venue', 'Networking', 'Content', 'Organization'] },
    { id: '5', type: 'text', question: 'Suggestions for future events?', required: false },
  ],
};

export function StepQuestions({ campaignType, questions, onChange }: StepQuestionsProps) {
  const { toast } = useToast();
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddQuestion = () => {
    const newQuestion: CampaignQuestion = {
      id: crypto.randomUUID(),
      type: 'rating',
      question: '',
      required: true,
    };
    onChange([...questions, newQuestion]);
  };

  const handleUpdateQuestion = (index: number, updates: Partial<CampaignQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleRemoveQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const handleUseSuggestions = () => {
    const suggested = suggestedQuestions[campaignType].map((q) => ({
      ...q,
      id: crypto.randomUUID(),
    }));
    onChange(suggested);
    toast({
      title: 'Questions added',
      description: `${suggested.length} suggested questions have been added.`,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload a PDF, Word, or Excel file.',
      });
      return;
    }

    setIsProcessingDocument(true);
    
    try {
      // For now, show a message that AI processing would happen here
      // In a full implementation, this would upload to an edge function
      // that uses AI to extract questions from the document
      
      toast({
        title: 'Document uploaded',
        description: 'AI analysis of document content would generate questions here. For now, use the suggested questions or add manually.',
      });
      
      // Auto-load suggestions as a fallback
      if (questions.length === 0) {
        handleUseSuggestions();
      }
    } catch (error) {
      console.error('Error processing document:', error);
      toast({
        variant: 'destructive',
        title: 'Processing failed',
        description: 'Could not process the document. Please try again.',
      });
    } finally {
      setIsProcessingDocument(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleUseSuggestions}>
          <Wand2 className="mr-2 h-4 w-4" />
          Use Suggested Questions
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFileUpload}
        />
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingDocument}
        >
          {isProcessingDocument ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Upload Document
        </Button>

        <Button variant="outline" size="sm" onClick={handleAddQuestion}>
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload a PDF, Word, or Excel file to auto-generate questions, or build your questionnaire manually.
      </p>

      {questions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No questions yet. Use suggested questions or add your own.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Q{index + 1}
                      </Badge>
                      <Select
                        value={question.type}
                        onValueChange={(type: CampaignQuestion['type']) =>
                          handleUpdateQuestion(index, { type })
                        }
                      >
                        <SelectTrigger className="w-[180px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(questionTypeLabels).map(([type, label]) => (
                            <SelectItem key={type} value={type}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="flex items-center gap-2 ml-auto">
                        <Label htmlFor={`required-${index}`} className="text-xs">
                          Required
                        </Label>
                        <Switch
                          id={`required-${index}`}
                          checked={question.required}
                          onCheckedChange={(required) =>
                            handleUpdateQuestion(index, { required })
                          }
                        />
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveQuestion(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    
                    <Input
                      placeholder="Enter your question..."
                      value={question.question}
                      onChange={(e) =>
                        handleUpdateQuestion(index, { question: e.target.value })
                      }
                    />
                    
                    {question.type === 'multiple_choice' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Options (comma-separated)</Label>
                        <Input
                          placeholder="Option 1, Option 2, Option 3"
                          value={question.options?.join(', ') || ''}
                          onChange={(e) =>
                            handleUpdateQuestion(index, {
                              options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
