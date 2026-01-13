// const fetch = require('node-fetch'); 

async function testUpdateMember() {
    const API_URL = 'http://localhost:3005/api/member';
    
    // 1. Create a mock member object WITH arrears_balance (to simulate the bug)
    const memberWithBug = {
        id: 'test-bug-id',
        membershipId: '99-99999',
        email: 'bug@test.com',
        phone: '1234567890',
        fullName: 'Bug Test',
        dateOfJoining: '2023-01-01',
        status: 'ACTIVE',
        role: 'MEMBER',
        arrears_balance: 5000 // This field does not exist in DB schema
    };

    console.log('Testing payload WITH arrears_balance...');
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memberWithBug)
        });
        
        if (!res.ok) {
            const data = await res.json();
            console.log('Expected Failure (Status):', res.status);
            console.log('Error Message:', data.error);
        } else {
            console.log('UNEXPECTED SUCCESS: Payload with arrears_balance was accepted.');
        }
    } catch (err) {
        console.log('Fetch error:', err.message);
    }

    // 2. Create a mock member object WITHOUT arrears_balance (the fix)
    const memberFixed = {
        id: 'test-fix-id',
        membershipId: '99-88888',
        email: 'fix@test.com',
        phone: '0987654321',
        fullName: 'Fix Test',
        dateOfJoining: '2023-01-01',
        status: 'ACTIVE',
        role: 'MEMBER',
        // arrears_balance removed
        password: 'NewPassword123'
    };

    console.log('\nTesting payload WITHOUT arrears_balance...');
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memberFixed)
        });
        
        if (res.ok) {
            console.log('SUCCESS: Payload without arrears_balance was accepted.');
        } else {
            const data = await res.json();
            console.log('FAILURE (Status):', res.status);
            console.log('Error Message:', data.error);
        }
    } catch (err) {
        console.log('Fetch error:', err.message);
    }
}

testUpdateMember();
