import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { SatisfactionSlider } from '@/components/feedback/SatisfactionSlider';
import { StarRating } from '@/components/feedback/StarRating';
import { LikertScale } from '@/components/feedback/LikertScale';
import { ImprovementAreas } from '@/components/feedback/ImprovementAreas';
import { CheckCircle2, AlertCircle, Loader2, Building2 } from 'lucide-react';
import type { FeedbackFormData } from '@/lib/supabase-types';

interface LinkData {
  id: string;
  company_name: string;
  company_logo_url: string | null;
  campaign_name: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

export default function FeedbackForm() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FeedbackFormData>({
    overall_satisfaction: 5,
    service_quality: 3,
    recommendation_likelihood: 3,
    improvement_areas: [],
    additional_comments: '',
  });

  useEffect(() => {
    if (code) {
      loadLinkData();
      incrementAccessCount();
    }
  }, [code]);

  const loadLinkData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_feedback_link_data', { p_code: code! });

      if (error || !data) {
        setError('This feedback link is not valid.');
        setIsLoading(false);
        return;
      }

      const linkInfo = data as unknown as {
        id: string;
        is_active: boolean;
        company_name: string;
        company_logo_url: string | null;
        campaign_name: string;
        start_date: string;
        end_date: string;
      };

      if (!linkInfo.is_active) {
        setError('This feedback form is no longer accepting responses.');
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const startDate = new Date(linkInfo.start_date);
      const endDate = new Date(linkInfo.end_date);

      if (now < startDate) {
        setError('This feedback campaign has not started yet.');
        setIsLoading(false);
        return;
      }

      if (now > endDate) {
        setError('This feedback campaign has ended.');
        setIsLoading(false);
        return;
      }

      setLinkData(linkInfo);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading link data:', err);
      setError('Failed to load the feedback form. Please try again.');
      setIsLoading(false);
    }
  };

  const incrementAccessCount = async () => {
    if (!code) return;
    await supabase.rpc('increment_access_count', { link_code: code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkData) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('feedback_responses').insert({
        link_id: linkData.id,
        overall_satisfaction: formData.overall_satisfaction,
        service_quality: formData.service_quality,
        recommendation_likelihood: formData.recommendation_likelihood,
        improvement_areas: formData.improvement_areas,
        additional_comments: formData.additional_comments || null,
      });

      if (error) throw error;

      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit your feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading feedback form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                Unable to Load Form
              </h2>
              <p className="mt-2 text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => navigate('/')}
              >
                Go to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
              <h2 className="mt-4 text-2xl font-semibold text-foreground">
                Thank You!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Your feedback has been submitted successfully. We appreciate your
                time and valuable input.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {linkData?.company_logo_url ? (
            <img
              src={linkData.company_logo_url}
              alt={`${linkData.company_name} logo`}
              className="h-16 w-auto mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary mb-4">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{linkData?.company_name}</span>
            </div>
          )}
          <h1 className="text-3xl font-bold text-foreground">
            {linkData?.campaign_name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your feedback is completely anonymous and helps us improve our services.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Overall Satisfaction */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overall Experience</CardTitle>
                <CardDescription>
                  How would you rate your overall satisfaction with our services?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SatisfactionSlider
                  value={formData.overall_satisfaction}
                  onChange={(value) =>
                    setFormData({ ...formData, overall_satisfaction: value })
                  }
                  label="Overall Satisfaction"
                  description="Rate from 1 (Very Dissatisfied) to 10 (Very Satisfied)"
                />
              </CardContent>
            </Card>

            {/* Service Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Quality</CardTitle>
                <CardDescription>
                  How would you rate the quality of our service/product?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StarRating
                  value={formData.service_quality}
                  onChange={(value) =>
                    setFormData({ ...formData, service_quality: value })
                  }
                  label="Service Quality Rating"
                />
              </CardContent>
            </Card>

            {/* Recommendation Likelihood */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendation</CardTitle>
                <CardDescription>
                  How likely are you to recommend our services to a colleague?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LikertScale
                  value={formData.recommendation_likelihood}
                  onChange={(value) =>
                    setFormData({ ...formData, recommendation_likelihood: value })
                  }
                  label="Recommendation Likelihood"
                />
              </CardContent>
            </Card>

            {/* Areas for Improvement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Areas for Improvement</CardTitle>
                <CardDescription>
                  Select any areas where you think we could improve (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImprovementAreas
                  value={formData.improvement_areas}
                  onChange={(value) =>
                    setFormData({ ...formData, improvement_areas: value })
                  }
                  label="Select all that apply"
                />
              </CardContent>
            </Card>

            {/* Additional Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Comments</CardTitle>
                <CardDescription>
                  Share any additional thoughts or suggestions (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.additional_comments}
                  onChange={(e) =>
                    setFormData({ ...formData, additional_comments: e.target.value })
                  }
                  placeholder="Your comments here..."
                  rows={4}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Feedback'
              )}
            </Button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          This survey is confidential. No personal information is collected.
        </p>
      </div>
    </div>
  );
}
