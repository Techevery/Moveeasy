-- Roles enum + table (separate, for security)
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'));
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Customers
CREATE TYPE public.customer_status AS ENUM ('active','inactive','blacklisted');

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  occupation TEXT,
  id_type TEXT,
  id_number TEXT,
  photo_url TEXT,
  notes TEXT,
  status public.customer_status NOT NULL DEFAULT 'active',
  emergency_name TEXT,
  emergency_relationship TEXT,
  emergency_phone TEXT,
  emergency_email TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_customers_status ON public.customers(status);

-- Storage units
CREATE TYPE public.unit_status AS ENUM ('vacant','occupied','reserved','maintenance');
CREATE TYPE public.unit_size AS ENUM ('small','medium','large','custom');

CREATE TABLE public.storage_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  size public.unit_size NOT NULL DEFAULT 'medium',
  dimensions TEXT,
  floor_level INT DEFAULT 0,
  climate_controlled BOOLEAN NOT NULL DEFAULT false,
  weekly_price NUMERIC(12,2),
  monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  yearly_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status public.unit_status NOT NULL DEFAULT 'vacant',
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.storage_units ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_units_status ON public.storage_units(status);

-- Rentals
CREATE TYPE public.billing_cycle AS ENUM ('weekly','monthly','quarterly','yearly');
CREATE TYPE public.rental_status AS ENUM ('active','expired','overdue','cancelled');

CREATE TABLE public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.storage_units(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  rate NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  security_deposit NUMERIC(12,2) DEFAULT 0,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  grace_days INT NOT NULL DEFAULT 3,
  contract_url TEXT,
  status public.rental_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rentals_customer ON public.rentals(customer_id);
CREATE INDEX idx_rentals_unit ON public.rentals(unit_id);
CREATE INDEX idx_rentals_status ON public.rentals(status);
CREATE INDEX idx_rentals_end_date ON public.rentals(end_date);

-- Payments
CREATE TYPE public.payment_method AS ENUM ('cash','pos','bank_transfer','online');
CREATE TYPE public.payment_status AS ENUM ('paid','partial','pending','failed','refunded');

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference TEXT,
  status public.payment_status NOT NULL DEFAULT 'paid',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_url TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payments_rental ON public.payments(rental_id);
CREATE INDEX idx_payments_customer ON public.payments(customer_id);
CREATE INDEX idx_payments_paid_at ON public.payments(paid_at);

-- Reminders
CREATE TYPE public.reminder_channel AS ENUM ('email','in_app','sms','whatsapp');
CREATE TYPE public.reminder_status AS ENUM ('scheduled','sent','failed','cancelled');

CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel public.reminder_channel NOT NULL DEFAULT 'in_app',
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status public.reminder_status NOT NULL DEFAULT 'scheduled',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_reminders_status ON public.reminders(status);
CREATE INDEX idx_reminders_scheduled ON public.reminders(scheduled_for);

-- In-app notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);

-- Settings (single row)
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT 'MoveEasy',
  company_logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  reminder_days_before INT[] NOT NULL DEFAULT ARRAY[7,3,1],
  reminder_days_after INT[] NOT NULL DEFAULT ARRAY[1,3,7],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.settings (id) VALUES (1);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_units_updated BEFORE UPDATE ON public.storage_units FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_rentals_updated BEFORE UPDATE ON public.rentals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- New user trigger: profile + default 'customer' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS POLICIES =====

-- user_roles: user can read own; admin can manage all
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin reads all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- profiles: user manages own; staff/admin read all
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "staff reads profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- customers: staff/admin all; customer reads only their own linked record
CREATE POLICY "staff manages customers" ON public.customers FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "customer reads own" ON public.customers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "customer updates own" ON public.customers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- storage_units: everyone authenticated reads; staff manages
CREATE POLICY "auth reads units" ON public.storage_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manages units" ON public.storage_units FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- rentals: staff all; customer reads own
CREATE POLICY "staff manages rentals" ON public.rentals FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "customer reads own rentals" ON public.rentals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = rentals.customer_id AND c.user_id = auth.uid())
);

-- payments
CREATE POLICY "staff manages payments" ON public.payments FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "customer reads own payments" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = payments.customer_id AND c.user_id = auth.uid())
);

-- reminders
CREATE POLICY "staff manages reminders" ON public.reminders FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "customer reads own reminders" ON public.reminders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = reminders.customer_id AND c.user_id = auth.uid())
);

-- notifications: user reads/updates own
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff inserts notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin(auth.uid()) OR user_id = auth.uid());

-- settings: anyone authenticated reads; admin updates
CREATE POLICY "auth reads settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin updates settings" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));