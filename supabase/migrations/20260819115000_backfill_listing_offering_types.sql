update public.listings
set offering_type = case
  when property_type ilike any (array['%commercial%', '%office%', '%retail%', '%mixed use%', '%mixed-use%', '%industrial%', '%warehouse%']) then 'lease'
  when asking_price < 100000 then 'rent'
  else 'sale'
end,
updated_at = now()
where deleted_at is null;
