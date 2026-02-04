-- Create enum for admin roles
CREATE TYPE public.app_role AS ENUM ('admin', 'super_admin');

-- Create companies table
CREATE TABLE public.companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaigns table
CREATE TABLE public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_campaign_links table (unique URLs per company per campaign)
CREATE TABLE public.company_campaign_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    unique_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    access_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, campaign_id)
);

-- Create feedback_responses table (anonymous responses)
CREATE TABLE public.feedback_responses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    link_id UUID NOT NULL REFERENCES public.company_campaign_links(id) ON DELETE CASCADE,
    overall_satisfaction INTEGER NOT NULL CHECK (overall_satisfaction >= 1 AND overall_satisfaction <= 10),
    service_quality INTEGER NOT NULL CHECK (service_quality >= 1 AND service_quality <= 5),
    recommendation_likelihood INTEGER NOT NULL CHECK (recommendation_likelihood >= 1 AND recommendation_likelihood <= 5),
    improvement_areas TEXT[] DEFAULT '{}',
    additional_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for admin access
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Create profiles table for admin users
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_campaign_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to check if user is any admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role IN ('admin', 'super_admin')
    )
$$;

-- RLS Policies for companies (admins only)
CREATE POLICY "Admins can view companies" ON public.companies
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert companies" ON public.companies
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update companies" ON public.companies
    FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete companies" ON public.companies
    FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- RLS Policies for campaigns (admins only)
CREATE POLICY "Admins can view campaigns" ON public.campaigns
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert campaigns" ON public.campaigns
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update campaigns" ON public.campaigns
    FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete campaigns" ON public.campaigns
    FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- RLS Policies for company_campaign_links
CREATE POLICY "Admins can view links" ON public.company_campaign_links
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view active links by code" ON public.company_campaign_links
    FOR SELECT TO anon
    USING (is_active = true);

CREATE POLICY "Admins can insert links" ON public.company_campaign_links
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update links" ON public.company_campaign_links
    FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete links" ON public.company_campaign_links
    FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- RLS Policies for feedback_responses
CREATE POLICY "Admins can view responses" ON public.feedback_responses
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can insert responses" ON public.feedback_responses
    FOR INSERT TO anon
    WITH CHECK (true);

-- RLS Policies for user_roles
CREATE POLICY "Admins can view roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Super admins can manage roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup (create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create function to increment access count
CREATE OR REPLACE FUNCTION public.increment_access_count(link_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.company_campaign_links
    SET access_count = access_count + 1
    WHERE unique_code = link_code;
END;
$$;