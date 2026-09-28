-- Shop&Drop V25.1 initial marketplace service-fee test schedule.
-- Seller target proceeds are the basis. Fee is added to form the published customer price.
-- Progressive tiers: first R1,000 8%; next R4,000 6.5%; next R15,000 5%; above R20,000 4%.
-- Application enforces a R10 minimum service fee for positive transaction amounts.
UPDATE commission_rules SET active=false,updated_at=now() WHERE active=true AND transaction_type IN ('all','product','service') AND category_id IS NULL;
INSERT INTO commission_rules(transaction_type,threshold_from_cents,threshold_to_cents,rate_basis_points,active,priority) VALUES
('all',0,100000,800,true,10),
('all',100000,500000,650,true,20),
('all',500000,2000000,500,true,30),
('all',2000000,NULL,400,true,40);
