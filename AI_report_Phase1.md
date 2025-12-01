# Phase 1

**1**


we used sift for feature matching, we arent yet well versed with sift functions and most of  the function usage was implemented using AI, thogh directed and guided by us

kp1, des1 = sift.detectAndCompute(img1, None)


**2**


usage of flann for knns was also recommended by AI

matches = flann.knnMatch(des1, des2, k=2)

**3**


also used 
img_matches = cv2.drawMatches(
        img1, kp1, img2, kp2, good_matches_50, None,
        flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS
    )

Syntax was corrected by AI