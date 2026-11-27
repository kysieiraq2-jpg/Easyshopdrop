-- Fix 199E-A: typed booking links and duplicate-event protection.
ALTER TABLE public.service_notifications ADD COLUMN dispatch_booking_id uuid REFERENCES public.dispatch_bookings(id) ON DELETE SET NULL;
ALTER TABLE public.service_notifications ADD CONSTRAINT shopdrop_service_notification_one_booking_199ea CHECK (booking_id IS NULL OR dispatch_booking_id IS NULL);
ALTER TABLE public.notifications ADD COLUMN service_booking_id uuid REFERENCES public.service_bookings(id) ON DELETE SET NULL,
 ADD COLUMN dispatch_booking_id uuid REFERENCES public.dispatch_bookings(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT shopdrop_notification_one_transaction_199ea CHECK (num_nonnulls(related_order_id,service_booking_id,dispatch_booking_id)<=1);
CREATE INDEX shopdrop_notifications_service_booking_199ea ON public.notifications(service_booking_id) WHERE service_booking_id IS NOT NULL;
CREATE INDEX shopdrop_notifications_dispatch_booking_199ea ON public.notifications(dispatch_booking_id) WHERE dispatch_booking_id IS NOT NULL;
CREATE INDEX shopdrop_service_notifications_dispatch_booking_199ea ON public.service_notifications(dispatch_booking_id) WHERE dispatch_booking_id IS NOT NULL;

-- Retain existing service notification storage; route transport to its own FK.
-- Existing public signature and service-role check remain unchanged.
DO $patch$
DECLARE
 src text:=pg_get_functiondef('public.create_transaction_notification(uuid,text,text,text,uuid,uuid,text)'::regprocedure);
 a text:=$a$    -- Booking/service messages use their existing table.$a$;
 b text:=$a$            booking_id,
            notification_type,$a$;
 c text:=$a$            p_booking_id,
            v_type,$a$;
BEGIN
 IF (length(src)-length(replace(src,a,'')))/length(a)<>1 OR
    (length(src)-length(replace(src,b,'')))/length(b)<>1 OR
    (length(src)-length(replace(src,c,'')))/length(c)<>1 THEN RAISE EXCEPTION '199ea notification source changed'; END IF;
 src:=replace(src,a,$a$    -- A supplied transaction must belong to the notification recipient.
    if p_order_id is not null and not exists (
        select 1 from public.orders o where o.id=p_order_id and p_user_id in(o.buyer_id,o.seller_id)
    ) then raise exception 'notification_order_recipient_mismatch' using errcode='42501'; end if;
    if p_booking_id is not null and v_type in ('service_booked','service_arrival_verified') and not exists (
        select 1 from public.service_bookings b where b.id=p_booking_id and p_user_id in(b.buyer_id,b.provider_id)
    ) then raise exception 'notification_service_recipient_mismatch' using errcode='42501'; end if;
    if p_booking_id is not null and v_type in ('dispatch_booked','dispatch_arrival_verified') and not exists (
        select 1 from public.dispatch_bookings b where b.id=p_booking_id and p_user_id in(b.customer_id,b.provider_id)
    ) then raise exception 'notification_dispatch_recipient_mismatch' using errcode='42501'; end if;
    -- Booking/service messages use their existing table.$a$);
 src:=replace(src,b,$a$            booking_id,
            dispatch_booking_id,
            notification_type,$a$);
 src:=replace(src,c,$a$            case when v_type in ('service_booked','service_arrival_verified') then p_booking_id end,
            case when v_type in ('dispatch_booked','dispatch_arrival_verified') then p_booking_id end,
            v_type,$a$);
 EXECUTE src;
END $patch$;

-- Current 193h path: keep existing delivery/preferences/idempotency and attach
-- the exact booking to the in-app notification after existing ownership checks.
DO $patch$
DECLARE
 src text:=pg_get_functiondef('shopdrop_service_193c.notify_193h(text,uuid,uuid,text,text,text,boolean)'::regprocedure);
 a text:=$a$insert into public.notifications(user_id,notification_type,title,message) values(u,'account_notice',subject,body) returning id into n;$a$;
BEGIN
 IF (length(src)-length(replace(src,a,'')))/length(a)<>1 THEN RAISE EXCEPTION '199ea 193h source changed'; END IF;
 src:=replace(src,a,$a$insert into public.notifications(user_id,notification_type,title,message,service_booking_id,dispatch_booking_id)
 values(u,'account_notice',subject,body,case when k='service' then b end,case when k='dispatch' then b end) returning id into n;$a$);
 EXECUTE src;
END $patch$;

-- Check the identity of retries BEFORE returning an existing notification.
DO $patch$
DECLARE
 src text:=pg_get_functiondef('public.process_notification_event(text,uuid,text,text,text,uuid,uuid)'::regprocedure);
 a text:=$a$    if v_queue.status = 'processed' then$a$;
 b text:=$a$    -- Do not allow an existing event key to be
    -- reused for a different recipient or event.
    if v_queue.recipient_id is distinct from p_recipient_id
       or v_queue.notification_type is distinct from p_type
    then
        raise exception 'event_key_conflict';
    end if;$a$;
BEGIN
 IF (length(src)-length(replace(src,a,'')))/length(a)<>1 OR (length(src)-length(replace(src,b,'')))/length(b)<>1 THEN RAISE EXCEPTION '199ea event source changed'; END IF;
 src:=replace(src,b,'');
 src:=replace(src,a,$a$    if v_queue.recipient_id is distinct from p_recipient_id
       or v_queue.notification_type is distinct from p_type
       or v_queue.order_id is distinct from p_order_id
       or v_queue.booking_id is distinct from p_booking_id
    then raise exception 'event_key_conflict'; end if;
    if v_queue.status = 'processed' then$a$);
 EXECUTE src;
END $patch$;

-- Ordinary users may mark their own notices read, not rewrite notification content.
REVOKE UPDATE ON public.notifications, public.service_notifications FROM authenticated;
GRANT UPDATE(is_read,read_at) ON public.notifications,public.service_notifications TO authenticated;
