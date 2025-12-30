# 🚀 Deployment Checklist - Image Editing Feature

## Pre-Deployment ✅

### Code Review
- [ ] Review `backend/app/api/ai_generation.py` changes
- [ ] Review new endpoints for security issues
- [ ] Check error handling coverage
- [ ] Verify type hints are complete
- [ ] Check logging statements

### Testing
- [ ] Run `test_image_editing_api.py` locally
- [ ] Test upload endpoint with various file types
- [ ] Test each edit type (rotate_cw, rotate_ccw, back_view, generic)
- [ ] Test generic_edit with custom prompts
- [ ] Test error cases (bad params, low credits, timeouts)
- [ ] Verify credit deduction works correctly

### Dependencies
- [ ] Verify `jinja2==3.1.2` in requirements.txt
- [ ] Verify `pillow==10.1.0` in requirements.txt
- [ ] Verify `fal-client==0.3.1` in requirements.txt
- [ ] Run `pip install -r requirements.txt` successfully
- [ ] Verify no version conflicts

### Environment Setup
- [ ] Ensure `FAL_KEY` is set in `.env`
- [ ] Ensure `FAL_KEY` is in Docker secrets/environment
- [ ] Test FAL AI connection before deployment
- [ ] Verify upload directory permissions

### File Structure
- [ ] Verify `/backend/app/prompts/` directory exists
- [ ] Verify all 4 template files present:
  - [ ] `rotate_90_cw.jinja`
  - [ ] `rotate_90_ccw.jinja`
  - [ ] `back_view.jinja`
  - [ ] `generic_edit.jinja`
- [ ] Verify `__init__.py` in prompts directory

---

## Deployment Steps

### 1. Update Dependencies
```bash
cd backend/
pip install -r requirements.txt
```
- [ ] No errors during installation
- [ ] All packages installed successfully

### 2. Verify Template Directory
```bash
ls -la app/prompts/
```
- [ ] Shows all 4 .jinja files
- [ ] Shows __init__.py

### 3. Database Check
```bash
# Ensure database has Price table
# Run migrations if needed
```
- [ ] Database connection works
- [ ] Price table exists
- [ ] User credits system working

### 4. FAL AI Configuration
```bash
# Test FAL connection
python -c "import fal_client; print('FAL client ready')"
```
- [ ] fal-client imports successfully
- [ ] FAL_KEY environment variable set
- [ ] Can connect to FAL AI service

### 5. Run Tests (if available)
```bash
pytest backend/tests/
# (tests to be added)
```
- [ ] All tests pass
- [ ] No regressions

### 6. Docker Build (if using Docker)
```bash
docker-compose build backend
```
- [ ] Build succeeds
- [ ] No warnings about missing dependencies
- [ ] FAL_KEY available in container

### 7. Start Services
```bash
docker-compose up -d
# or
python -m uvicorn app.main:app --reload
```
- [ ] API starts without errors
- [ ] Logs show successful startup
- [ ] Health check passes

---

## Post-Deployment ✅

### Endpoint Verification
- [ ] `POST /api/ai/upload` responds to requests
- [ ] `POST /api/ai/edit` responds to requests
- [ ] Both endpoints require authentication
- [ ] Both endpoints validate input

### Functional Tests
```bash
# Upload test
curl -X POST http://localhost:8000/api/ai/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "image_file=@test.png"
```
- [ ] Returns 200 with URL
- [ ] File uploads successfully
- [ ] URL is accessible

```bash
# Edit test  
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image_url":"...", "edit_type":"rotate_90_cw"}'
```
- [ ] Returns 200 with edited images
- [ ] Credits deducted from user
- [ ] Processing completes within timeout

### Error Handling
- [ ] Test missing parameters → 400
- [ ] Test bad auth → 401
- [ ] Test low credits → 402
- [ ] Test timeout → 504
- [ ] Error messages are helpful (no system details)

### Performance
- [ ] Upload completes in < 5 seconds
- [ ] Edit requests respond quickly (polling works)
- [ ] Database queries are fast
- [ ] No memory leaks with repeated requests

### Security
- [ ] All endpoints require authentication
- [ ] File upload validates file types
- [ ] File upload has size limits
- [ ] No sensitive data in error messages
- [ ] No SQL injection vulnerabilities
- [ ] No path traversal issues

### Logging
- [ ] Check server logs for errors
- [ ] Verify credit deductions are logged
- [ ] Check for any warnings or issues
- [ ] Review request patterns for anomalies

### Monitoring
- [ ] Set up monitoring for:
  - [ ] Endpoint response times
  - [ ] Error rates
  - [ ] Credit usage
  - [ ] FAL AI API calls
  - [ ] Database performance

---

## Rollback Plan

If issues occur post-deployment:

### Option 1: Quick Rollback
```bash
git revert <commit-hash>
docker-compose rebuild backend
docker-compose up -d
```

### Option 2: Disable Feature
```python
# Comment out in app/main.py
# app.include_router(ai_generation.router)
```

### Option 3: Remove Endpoints
```python
# Remove from ai_generation.py:
# - edit_image endpoint
# - upload_image_endpoint  
# - Keep helper functions for future use
```

---

## Monitoring & Maintenance

### Daily Checks
- [ ] No spike in error rates
- [ ] Response times normal
- [ ] FAL AI API quota OK
- [ ] Database performing well

### Weekly Checks
- [ ] Review credit usage patterns
- [ ] Check for stuck/timed-out requests
- [ ] Monitor template rendering
- [ ] Review user feedback

### Monthly Checks
- [ ] Update fal-client if new version available
- [ ] Review and update prompts based on feedback
- [ ] Analyze usage patterns
- [ ] Plan feature enhancements

---

## Feature Flag (Optional)

For safer rollout, consider adding a feature flag:

```python
# In config or environment
ENABLE_IMAGE_EDITING = True  # Set to False to disable

# In endpoint
if not ENABLE_IMAGE_EDITING:
    raise HTTPException(status_code=503, detail="Feature disabled")
```

---

## Documentation Updates

After deployment, ensure:
- [ ] Update main README if needed
- [ ] API documentation is current
- [ ] Examples are tested and work
- [ ] Error codes documented
- [ ] Response schemas up-to-date

---

## User Communication

- [ ] Notify users of new feature
- [ ] Provide documentation link
- [ ] Share API examples/tutorials
- [ ] Set expectations for credits usage
- [ ] Provide feedback mechanism

---

## Success Criteria

Deployment is successful when:
- ✅ All endpoints respond correctly
- ✅ Credits deducted accurately
- ✅ Edit requests complete successfully
- ✅ Error handling works as expected
- ✅ No errors in logs
- ✅ Response times acceptable
- ✅ Security checks pass
- ✅ Users can access the feature

---

## Support Resources

If issues arise:
- [ ] Check logs: `docker logs <container-id>`
- [ ] Check database: Query Price table
- [ ] Check FAL AI: Verify API key and quota
- [ ] Check templates: Verify file contents
- [ ] Check network: Verify connectivity to FAL

---

## Contact & Escalation

Critical Issues:
- [ ] Notify development team immediately
- [ ] Check error logs for root cause
- [ ] Consider rolling back if necessary
- [ ] Document issue and resolution

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Approved By**: ___________

**Notes**:
```
_________________________________
_________________________________
_________________________________
```

---

Ready to deploy? ✅
