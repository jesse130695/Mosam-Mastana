/* ============================================================
   MOSAM MASTANA — Curated India place data (F1)
   Quick picks are curated, not exhaustive. Search remains
   available for every other Indian and global location.
   ============================================================ */

// Popular Indian city quick picks by zone (from PRD F1)
export const POPULAR_ZONES = [
  {
    zone: 'North',
    cities: ['Delhi', 'Chandigarh', 'Jaipur', 'Lucknow', 'Dehradun', 'Shimla', 'Srinagar', 'Amritsar', 'Varanasi', 'Jammu'],
  },
  {
    zone: 'West',
    cities: ['Mumbai', 'Pune', 'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Nagpur', 'Nashik', 'Panaji'],
  },
  {
    zone: 'South',
    cities: ['Bengaluru', 'Chennai', 'Hyderabad', 'Kochi', 'Thiruvananthapuram', 'Coimbatore', 'Mysuru', 'Mangaluru', 'Visakhapatnam', 'Vijayawada'],
  },
  {
    zone: 'East & North-East',
    cities: ['Kolkata', 'Bhubaneswar', 'Patna', 'Ranchi', 'Guwahati', 'Shillong', 'Imphal', 'Agartala', 'Aizawl', 'Itanagar'],
  },
  {
    zone: 'Central',
    cities: ['Bhopal', 'Indore', 'Raipur', 'Jabalpur', 'Gwalior'],
  },
];

// All Indian States and Union Territories (PRD F1)
export const STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi (NCT)', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// Curated localities per state/UT for the browse panel. Provider search still
// runs so anything missing here can be found by typing.
export const STATE_PLACES = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore', 'Kurnool'],
  'Arunachal Pradesh': ['Itanagar', 'Tawang', 'Pasighat', 'Ziro', 'Bomdila'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Tinsukia'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia'],
  'Chhattisgarh': ['Raipur', 'Bilaspur', 'Durg', 'Korba', 'Jagdalpur'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Junagadh', 'Gandhinagar'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Karnal', 'Rohtak'],
  'Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Palampur'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Hazaribagh'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Shivamogga', 'Udupi'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Chhatrapati Sambhajinagar', 'Solapur', 'Kolhapur', 'Amravati'],
  'Manipur': ['Imphal', 'Thoubal', 'Churachandpur', 'Ukhrul'],
  'Meghalaya': ['Shillong', 'Tura', 'Cherrapunji', 'Jowai'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur', 'Berhampur'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Bharatpur'],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Erode', 'Tirunelveli', 'Vellore'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Gorakhpur', 'Meerut', 'Noida'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Rishikesh', 'Nainital', 'Almora', 'Haldwani', 'Mussoorie'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol', 'Darjeeling', 'Kharagpur'],
  'Andaman and Nicobar Islands': ['Port Blair', 'Diglipur'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
  'Delhi (NCT)': ['New Delhi', 'Delhi'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Gulmarg', 'Pahalgam', 'Katra', 'Anantnag'],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti', 'Agatti'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
};
