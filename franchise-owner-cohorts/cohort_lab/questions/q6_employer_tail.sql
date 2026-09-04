-- title: Employer tail
-- Every normalized employer string, rarest first, with the sector and
-- franchise-brand tags the classifiers gave it. This is where classifier
-- errors live: an employer seen once and tagged as a franchise brand, or a
-- sector that reads wrong, is fixed by editing config/vocab.yaml or
-- config/approved_brands.csv and rebuilding — never by editing this output.
SELECT company, company_norm, record_count, person_count, sector_tag, sector_source,
       is_franchise_brand, franchise_brand, brand_segment, brand_family, entity_kind,
       ownership_role_share, top_titles
FROM employers
ORDER BY record_count ASC, company_norm;
