-- Contracts bucket policies
-- Policy 1: Allow authenticated users to upload to contracts bucket
CREATE POLICY "contracts_allow_authenticated_uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- Policy 2: Allow authenticated users to read from contracts bucket
CREATE POLICY "contracts_allow_authenticated_reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'contracts');

-- Policy 3: Allow authenticated users to delete from contracts bucket
CREATE POLICY "contracts_allow_authenticated_deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'contracts');

-- Expenses bucket policies
-- Policy 1: Allow authenticated users to upload to expenses bucket
CREATE POLICY "expenses_allow_authenticated_uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expenses');

-- Policy 2: Allow authenticated users to read from expenses bucket
CREATE POLICY "expenses_allow_authenticated_reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'expenses');

-- Policy 3: Allow authenticated users to delete from expenses bucket
CREATE POLICY "expenses_allow_authenticated_deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'expenses');
